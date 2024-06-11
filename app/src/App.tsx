import Indicator from "@/components/components/indicators";
import { SliderBlur } from "@/components/components/slider-blur";
import RealTimeTemperatureChart from "@/components/components/thermal-graph";
import ThermalHeatmap from "@/components/thermal";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import axios from "axios";
import { Settings } from "lucide-react";
import React, { useEffect, useState } from "react";
import "./App.css";

interface ThermalData {
  frame: number[];
  maxHet: number;
  minHet: number;
}

const getDefaultConfig = () => ({
  temperatureThreshold: parseFloat(
    localStorage.getItem("temperatureThreshold") || "40.1"
  ),
  blurRadius: parseFloat(localStorage.getItem("blurRadius") || "8"),
  apiUrl:
    localStorage.getItem("apiUrl") || "http://192.168.0.159:5000/thermal_data",
});

const App: React.FC = () => {
  const [data, setData] = useState<ThermalData | null>(null);
  const [lastRefreshed, setLastRefreshed] = useState<Date>(new Date());
  const [config, setConfig] = useState(getDefaultConfig());
  const [isDialogOpen, setIsDialogOpen] = useState<boolean>(false);

  const fetchData = async () => {
    setLastRefreshed(new Date());
    try {
      const response = await axios.get<ThermalData>(config.apiUrl);
      setData(response.data);
    } catch (error) {
      console.error("Error fetching thermal data:", error);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 300);
    return () => clearInterval(interval);
  }, [config.apiUrl]);

  useEffect(() => {
    localStorage.setItem(
      "temperatureThreshold",
      config.temperatureThreshold.toString()
    );
    localStorage.setItem("blurRadius", config.blurRadius.toString());
    localStorage.setItem("apiUrl", config.apiUrl);
  }, [config]);

  const highFeverDetected = data
    ? data.frame.some((temp) => temp >= config.temperatureThreshold)
    : false;

  const handleConfigChange = (key: string, value: any) => {
    setConfig((prevConfig) => ({
      ...prevConfig,
      [key]: value,
    }));
  };

  return (
    <div className="flex flex-col gap-2">
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

      <Card className="w-full">
        <CardHeader>
          <h1 className="text-lg font-medium md:text-xl">
            Realtime Live Heatmap of Thermal Camera
          </h1>
          <p>Fever Detection using Thermal Sensing for Brooding Chicks</p>
        </CardHeader>
        <CardContent className="flex items-center justify-center w-full h-full">
          {data ? (
            <ThermalHeatmap data={data} blurRadius={config.blurRadius} />
          ) : (
            <Skeleton className="w-[320px] h-[240px]"></Skeleton>
          )}
        </CardContent>
      </Card>
      <RealTimeTemperatureChart />
      <div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button variant="outline">
              <span className="mr-2">
                <Settings />
              </span>
              Settings
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-[325px] md:max-w-[400px]: lg:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>Settings</DialogTitle>
              <DialogDescription>
                Change the settings for the thermal camera
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="w-full">
                <Label htmlFor="apiUrl" className="text-right">
                  Blur Radius
                </Label>
                <SliderBlur
                  defaultValue={[config.blurRadius]}
                  max={50}
                  step={1}
                  onValueChange={(value) =>
                    handleConfigChange("blurRadius", value[0])
                  }
                  className="w-full py-2"
                />
                <h2>{config.blurRadius}px</h2>
              </div>
              <div>
                <Label htmlFor="apiUrl" className="text-right">
                  Temperature Threshold
                </Label>
                <SliderBlur
                  defaultValue={[config.temperatureThreshold]}
                  max={50}
                  step={0.1}
                  className="w-full py-2"
                  onValueChange={(value) =>
                    handleConfigChange("temperatureThreshold", value[0])
                  }
                />
                <h2>{config.temperatureThreshold.toFixed(1)}°C </h2>
              </div>
              <div className="grid items-center grid-cols-4 gap-4">
                <Label htmlFor="apiUrl" className="text-left">
                  API URL
                </Label>
                <Input
                  id="apiUrl"
                  value={config.apiUrl}
                  onChange={(e) => handleConfigChange("apiUrl", e.target.value)}
                  className="col-span-4"
                />
              </div>
            </div>
            <DialogFooter>
              <Button onClick={() => setIsDialogOpen(false)}>
                Save changes
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
};

const averageTemp = (frame: number[]): number => {
  return frame.reduce((sum, temp) => sum + temp, 0) / frame.length;
};

export default App;
