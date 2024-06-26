import * as d3 from "d3";
import React, { useEffect, useRef } from "react";

interface ThermalData {
  frame: number[];
  maxHet: number;
  minHet: number;
}

interface ThermalHeatmapProps {
  data: ThermalData | null;
  blurRadius: number;
}

const CONFIG = {
  width: 320,
  height: 240,
  numCols: 16,
  numRows: 12,
  fontSize: 30,
  centerIndex: 95,
};

const ThermalHeatmap: React.FC<ThermalHeatmapProps> = ({
  data,
  blurRadius,
}) => {
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (data) {
      drawHeatmap(data);
    }
  }, [data, blurRadius]);

  const drawHeatmap = (thermalData: ThermalData) => {
    const { frame, maxHet, minHet } = thermalData;
    const svg = d3.select(svgRef.current);
    const pixelWidth = CONFIG.width / CONFIG.numCols;
    const pixelHeight = CONFIG.height / CONFIG.numRows;

    svg.selectAll("*").remove();

    svg
      .append("defs")
      .append("filter")
      .attr("id", "blur")
      .append("feGaussianBlur")
      .attr("stdDeviation", blurRadius); // Use blurRadius prop

    const g = svg.append("g").attr("filter", "url(#blur)");

    g.selectAll("rect")
      .data(frame)
      .enter()
      .append("rect")
      .attr("x", (_: any, i: number) => (i % CONFIG.numCols) * pixelWidth)
      .attr(
        "y",
        (_: any, i: number) => Math.floor(i / CONFIG.numCols) * pixelHeight
      )
      .attr("width", pixelWidth)
      .attr("height", pixelHeight)
      .attr("fill", (d: number) =>
        hsvToRgb(mapValue(d, minHet, maxHet, 180, 360))
      );

    // @ts-ignore
    drawCrosshair(svg, pixelWidth, pixelHeight);
    // @ts-ignore
    drawTemperatureText(svg, frame, pixelWidth, pixelHeight);
    // @ts-ignore
    drawColorScale(svg, minHet, maxHet);
  };

  const drawCrosshair = (
    svg: d3.Selection<SVGSVGElement, unknown, null, undefined>,
    pixelWidth: number,
    pixelHeight: number
  ) => {
    const centerX =
      (CONFIG.centerIndex % CONFIG.numCols) * pixelWidth + pixelWidth / 2;
    const centerY =
      Math.floor(CONFIG.centerIndex / CONFIG.numCols) * pixelHeight +
      pixelHeight / 2;

    svg
      .append("line")
      .attr("x1", centerX - 10)
      .attr("y1", centerY)
      .attr("x2", centerX + 10)
      .attr("y2", centerY)
      .attr("stroke", "white")
      .attr("stroke-width", 2);

    svg
      .append("line")
      .attr("x1", centerX)
      .attr("y1", centerY - 10)
      .attr("x2", centerX)
      .attr("y2", centerY + 10)
      .attr("stroke", "white")
      .attr("stroke-width", 2);
  };

  const drawTemperatureText = (
    svg: d3.Selection<SVGSVGElement, unknown, null, undefined>,
    frame: number[],
    pixelWidth: number,
    pixelHeight: number
  ) => {
    const centerX =
      (CONFIG.centerIndex % CONFIG.numCols) * pixelWidth + pixelWidth / 2;
    const centerY =
      Math.floor(CONFIG.centerIndex / CONFIG.numCols) * pixelHeight +
      pixelHeight / 2;

    svg
      .append("text")
      .attr("x", centerX + 15)
      .attr("y", centerY - 10)
      .attr("fill", "white")
      .attr("font-size", CONFIG.fontSize / 2)
      .text(`${frame[CONFIG.centerIndex].toFixed(1)}°`);

    svg
      .append("text")
      .attr("x", centerX + 15)
      .attr("y", centerY + 20)
      .attr("fill", "yellow")
      .attr("font-size", CONFIG.fontSize / 2)
      .text(`Avg: ${averageTemp(frame).toFixed(1)}°`);
  };

  const drawColorScale = (
    svg: d3.Selection<SVGSVGElement, unknown, null, undefined>,
    minHet: number,
    maxHet: number
  ) => {
    const scaleGroup = svg
      .append("g")
      .attr("transform", `translate(0, ${CONFIG.height})`);
    const colorScaleWidth = CONFIG.width / 5;

    for (let i = 0; i < 5; i++) {
      const temp = minHet + ((maxHet - minHet) / 5) * i;
      scaleGroup
        .append("rect")
        .attr("x", i * colorScaleWidth)
        .attr("width", colorScaleWidth)
        .attr("height", 20)
        .attr("fill", hsvToRgb(mapValue(temp, minHet, maxHet, 180, 360)));

      scaleGroup
        .append("text")
        .attr("x", i * colorScaleWidth + colorScaleWidth / 2)
        .attr("y", 35)
        .attr("fill", "black")
        .attr("font-size", CONFIG.fontSize / 2)
        .attr("text-anchor", "middle")
        .text(`${temp.toFixed(0)}°`);
    }
  };

  return <svg ref={svgRef} width={CONFIG.width} height={CONFIG.height + 50} />;
};

const mapValue = (
  value: number,
  inMin: number,
  inMax: number,
  outMin: number,
  outMax: number
): number => {
  return ((value - inMin) * (outMax - outMin)) / (inMax - inMin) + outMin;
};

const hsvToRgb = (hue: number): string => {
  const h = hue / 360;
  const s = 1.0;
  const v = 1.0;
  let r = 0,
    g = 0,
    b = 0;
  const i = Math.floor(h * 6);
  const f = h * 6 - i;
  const p = v * (1 - s);
  const q = v * (1 - f * s);
  const t = v * (1 - (1 - f) * s);

  switch (i % 6) {
    case 0:
      (r = v), (g = t), (b = p);
      break;
    case 1:
      (r = q), (g = v), (b = p);
      break;
    case 2:
      (r = p), (g = v), (b = t);
      break;
    case 3:
      (r = p), (g = q), (b = v);
      break;
    case 4:
      (r = t), (g = p), (b = v);
      break;
    case 5:
      (r = v), (g = p), (b = q);
      break;
  }

  return `rgb(${Math.round(r * 255)}, ${Math.round(g * 255)}, ${Math.round(
    b * 255
  )})`;
};

const averageTemp = (frame: number[]): number => {
  return frame.reduce((sum, temp) => sum + temp, 0) / frame.length;
};

export default ThermalHeatmap;
