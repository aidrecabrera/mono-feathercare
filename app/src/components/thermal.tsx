// ThermalHeatmap.tsx
import React, { useEffect, useRef, useState } from 'react';

interface ThermalData {
  frame: number[];
  maxHet: number;
  minHet: number;
}

const CONFIG = {
  minHue: 180,
  maxHue: 360,
  pixelSize: 20, // Adjusted pixel size for better visualization
  width: 320,
  height: 240,
  fontSize: 30,
  checkInterval: 10,
  temperatureThreshold: 34,
  centerIndex: 95,
  blurRadius: 10,
};

const ThermalHeatmap: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [data, setData] = useState<ThermalData | null>(null);
  const [countdown, setCountdown] = useState(CONFIG.checkInterval);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = {
            "frame": [
              40.573296452948796,
              39.25008440983777,
              38.382709214945976,
              39.468723021189135,
              38.798452629220264,
              39.01353244116439,
              37.98074749979105,
              38.68548610425256,
              39.264882036514564,
              38.43811253904909,
              37.847879602774526,
              37.94556266372524,
              38.90919005806762,
              37.64300035096551,
              37.09522322192953,
              35.42572038646506,
              39.155245185324986,
              38.0218371441797,
              37.38206876650884,
              38.26560423899434,
              50.69656876187486,
              38.995087613955945,
              38.43629451394395,
              38.63817634469365,
              39.33144097702069,
              36.592159869664215,
              36.48425441948524,
              38.97025133521805,
              39.207928789817004,
              38.80815447806077,
              37.72724365274888,
              36.961955417603576,
              37.222298505727565,
              36.65713869340186,
              36.15174219456293,
              36.87390852972396,
              38.24568008756148,
              39.2421814379033,
              39.36426735266781,
              39.89703347508845,
              39.086520341641915,
              36.12360914576777,
              37.12132211339065,
              39.24999918911857,
              39.43433401205385,
              38.646342208980855,
              37.99476121088259,
              37.50241319537349,
              37.16375877284611,
              36.64087828935766,
              36.30177720950849,
              36.7697987320193,
              37.548975354635786,
              38.243690757482284,
              38.614402476139276,
              38.03642405783569,
              38.37730476229922,
              39.090025353370436,
              38.47820535022589,
              38.14190810282628,
              38.992399490944024,
              38.90477405291023,
              37.854171503309544,
              37.32121268233624,
              36.96399803463959,
              36.27023678556378,
              34.37514075423201,
              34.3456814964382,
              33.8631455157726,
              36.42295808206961,
              38.28706582665086,
              37.84219577727657,
              37.610758812385086,
              38.33223928620697,
              39.60913056972555,
              38.423814998984426,
              39.05625492777858,
              39.170945129312315,
              38.142408359807064,
              38.01758004052573,
              36.465537823046645,
              35.424673353127446,
              34.13718507626487,
              33.09413193603905,
              32.79697819685924,
              32.85397645443584,
              35.9094433531464,
              36.560328475863514,
              37.28242045575928,
              37.46015445746423,
              37.941058275109924,
              38.81893919231641,
              39.01155997365606,
              38.62445341710571,
              36.84791661027094,
              37.26169992220525,
              36.14370682913136,
              35.27172552990214,
              33.98184930763847,
              33.04292290206149,
              32.8176913081536,
              32.26779238561136,
              32.56771164365637,
              34.80172916097598,
              37.39963980233307,
              37.75573253312177,
              38.05385526797863,
              38.10246351141393,
              38.35976928800136,
              37.88443355395526,
              35.27610714336646,
              33.46189452851411,
              35.847100308491974,
              34.80111787768527,
              34.08711139909059,
              33.330109712978185,
              32.82621704791967,
              32.550660873980235,
              31.788893710859725,
              32.19044279868524,
              35.103235910054764,
              37.39113980085557,
              37.983756639372245,
              38.35663242570041,
              37.9766427193552,
              36.915263954557304,
              35.65637638541534,
              33.294498031959904,
              35.341201538281325,
              34.780426347059404,
              34.26433075468327,
              33.390207561655586,
              32.97837769249003,
              32.75446010647613,
              32.190578904242045,
              32.23715464232981,
              32.10852344774668,
              33.0975588267562,
              33.92203337081759,
              34.9764068396874,
              34.20808668089171,
              33.063457542627816,
              32.945549026799426,
              33.254385188343974,
              35.270882862516146,
              34.63796232329213,
              34.03642564904612,
              33.95798304273444,
              33.619195176615506,
              33.19793708397788,
              32.21150520863614,
              32.35141132656338,
              32.57564199801078,
              32.56289740974353,
              31.776055093746777,
              32.196406861534285,
              32.48921727956014,
              33.167107564437515,
              33.1323296465315,
              33.663982745069745,
              35.02453157302136,
              35.10039961133441,
              10.01953896775723,
              33.99882245183761,
              34.142177884608714,
              33.569026420680814,
              33.24610062444981,
              32.81543968914417,
              32.89410009223451,
              32.794540536663305,
              32.45697408571016,
              33.11327289826511,
              33.001056663075815,
              33.56669500486345,
              34.13990934241559,
              34.15722454298651,
              35.07927481195469,
              34.939704123676904,
              34.92572450354629,
              34.30618150417814,
              34.44303351694924,
              34.238372354316425,
              33.70880055797005,
              33.78244752458647,
              33.79619717741201,
              33.51780008413908,
              33.392107887044745,
              33.66178012105922,
              34.24002221986967,
              34.30666457690222,
              34.41750203838376,
              34.71157090125769
            ],
            "maxHet": 40.573296452948796,
            "minHet": 31.776055093746777
          };
        setData(response);
      } catch (error) {
        console.error('Error fetching thermal data:', error);
      }
    };

    const interval = setInterval(fetchData, CONFIG.checkInterval * 1000);
    fetchData();

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (data && canvasRef.current) {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const { frame, maxHet, minHet } = data;
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Draw heatmap
      frame.forEach((temp, index) => {
        const x = (index % 16) * CONFIG.pixelSize;
        const y = Math.floor(index / 16) * CONFIG.pixelSize;
        const hue = mapValue(temp, minHet, maxHet, CONFIG.minHue, CONFIG.maxHue);
        ctx.fillStyle = `hsl(${hue}, 100%, 50%)`;
        ctx.fillRect(x, y, CONFIG.pixelSize, CONFIG.pixelSize);
      });

      // Draw crosshair
      ctx.strokeStyle = 'white';
      ctx.lineWidth = 2;
      const centerX = (CONFIG.centerIndex % 16) * CONFIG.pixelSize + CONFIG.pixelSize / 2;
      const centerY = Math.floor(CONFIG.centerIndex / 16) * CONFIG.pixelSize + CONFIG.pixelSize / 2;
      ctx.beginPath();
      ctx.moveTo(centerX - 10, centerY);
      ctx.lineTo(centerX + 10, centerY);
      ctx.moveTo(centerX, centerY - 10);
      ctx.lineTo(centerX, centerY + 10);
      ctx.stroke();

      // Draw text
      ctx.fillStyle = 'white';
      ctx.font = `${CONFIG.fontSize / 2}px Arial`;
      ctx.fillText(`${frame[CONFIG.centerIndex].toFixed(1)}°`, centerX + 15, centerY - 10);
      ctx.fillStyle = 'yellow';
      ctx.fillText(`Avg: ${averageTemp(frame).toFixed(1)}°`, centerX + 15, centerY + 20);

      // Draw color scale
      for (let i = 0; i <= 5; i++) {
        const temp = minHet + ((maxHet - minHet) / 5) * i;
        const hue = mapValue(temp, minHet, maxHet, CONFIG.minHue, CONFIG.maxHue);
        ctx.fillStyle = `hsl(${hue}, 100%, 50%)`;
        ctx.fillRect(i * 60, CONFIG.height, 60, 20);
        ctx.fillStyle = 'black';
        ctx.fillText(`${temp.toFixed(0)}°`, i * 60 + 20, CONFIG.height + 40);
      }
    }
  }, [data]);

  useEffect(() => {
    const interval = setInterval(() => {
      setCountdown((prev) => (prev > 0 ? prev - 1 : CONFIG.checkInterval));
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  return (
    <div>
      <canvas ref={canvasRef} width={CONFIG.width} height={CONFIG.height + 50} />
      <p>Checking in {countdown} seconds</p>
    </div>
  );
};

const mapValue = (value: number, inMin: number, inMax: number, outMin: number, outMax: number): number => {
  return ((value - inMin) * (outMax - outMin)) / (inMax - inMin) + outMin;
};

const averageTemp = (frame: number[]): number => {
  return frame.reduce((sum, temp) => sum + temp, 0) / frame.length;
};

export default ThermalHeatmap;
