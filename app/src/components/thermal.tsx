import * as d3 from "d3";
import React, { useEffect, useRef } from "react";

interface ThermalData {
  frame: number[];
  maxHet: number;
  minHet: number;
}

interface ThermalHeatmapProps {
  data: ThermalData | null;
}

const CONFIG = {
  width: 320,
  height: 240,
  numCols: 16,
  numRows: 12,
  fontSize: 30,
  centerIndex: 95,
  blurRadius: 10,
};

const ThermalHeatmap: React.FC<ThermalHeatmapProps> = ({ data }) => {
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (data) {
      drawHeatmap(data);
    }
  }, [data]);

  const drawHeatmap = (thermalData: ThermalData) => {
    const { frame, maxHet, minHet } = thermalData;
    const svg = d3.select(svgRef.current);
    const pixelWidth = CONFIG.width / CONFIG.numCols;
    const pixelHeight = CONFIG.height / CONFIG.numRows;

    svg.selectAll("*").remove();

    const colorScale = d3
      .scaleSequential(d3.interpolateCool)
      .domain([minHet, maxHet]);

    svg
      .append("defs")
      .append("filter")
      .attr("id", "blur")
      .append("feGaussianBlur")
      .attr("stdDeviation", CONFIG.blurRadius);

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
      .attr("fill", (d: number) => colorScale(d));

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

    const colorScale = d3
      .scaleSequential(d3.interpolateRainbow)
      .domain([minHet, maxHet]);

    for (let i = 0; i < 5; i++) {
      const temp = minHet + ((maxHet - minHet) / 5) * i;
      scaleGroup
        .append("rect")
        .attr("x", i * colorScaleWidth)
        .attr("width", colorScaleWidth)
        .attr("height", 20)
        .attr("fill", colorScale(temp));

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

const averageTemp = (frame: number[]): number => {
  return frame.reduce((sum, temp) => sum + temp, 0) / frame.length;
};

export default ThermalHeatmap;
