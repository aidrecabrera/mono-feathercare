import Indicator from "@/components/components/indicators";
import ThermalHeatmap from "@/components/thermal";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import axios from "axios";
import React, { useEffect, useState } from "react";
import "./App.css";

interface ThermalData {
  frame: number[];
  maxHet: number;
  minHet: number;
}

const CONFIG = {
  temperatureThreshold: 40.1,
};

const App: React.FC = () => {
  const [data, setData] = useState<ThermalData | null>(null);
  const [lastRefreshed, setLastRefreshed] = useState<Date>(new Date());

  const fetchData = async () => {
    setLastRefreshed(new Date());
    try {
      const response = await axios.get<ThermalData>(
        "http://localhost:5000/thermal"
      );
      setData(response.data);
    } catch (error) {
      console.error("Error fetching thermal data:", error);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 1000);
    return () => clearInterval(interval);
  }, []);

  const highFeverDetected = data
    ? data.frame.some((temp) => temp >= CONFIG.temperatureThreshold)
    : false;

  return (
    <div className="flex flex-col gap-2">
      <Card className="w-full">
        <CardHeader>
          <h1 className="text-lg font-medium md:text-xl">
            Chick Coop Live Heatmap
          </h1>
        </CardHeader>
        <CardContent className="flex items-center justify-center w-full h-full">
          {data ? (
            <ThermalHeatmap data={data} />
          ) : (
            <Skeleton className="w-[320px] h-[240px]"></Skeleton>
          )}
        </CardContent>
      </Card>
      <div>
        <Indicator
          title="High Fever"
          amount={highFeverDetected ? "Detected" : "Not Detected"}
          lastRefreshed={lastRefreshed || undefined}
        />
      </div>
      <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
        <Indicator
          title="Min Temperature"
          amount={data ? `${Math.min(...data.frame).toFixed(2)}°` : "N/A"}
        />
        <Indicator
          title="Max Temperature"
          amount={data ? `${Math.max(...data.frame).toFixed(2)}°` : "N/A"}
        />
        <Indicator
          title="Avg Temperature"
          amount={data ? `${averageTemp(data.frame).toFixed(2)}°` : "N/A"}
        />
      </div>
    </div>
  );
};

const averageTemp = (frame: number[]): number => {
  return frame.reduce((sum, temp) => sum + temp, 0) / frame.length;
};

export default App;
