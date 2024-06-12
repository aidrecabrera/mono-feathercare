import Indicator from "@/components/components/indicators";
import { SliderBlur } from "@/components/components/slider-blur";
import RealTimeTemperatureChart from "@/components/components/thermal-graph";
import ThermalHeatmap from "@/components/thermal";
import { Badge } from "@/components/ui/badge";
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
import axios from "axios";
import { Settings, TriangleAlert } from "lucide-react";
import React, { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
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
    localStorage.getItem("apiUrl") || "http://192.168.74.39:5000/thermal_data",
});

const useCheckConnection = (url: string, retries: number, interval: number) => {
  const [status, setStatus] = useState("");

  const checkConnection = useCallback(() => {
    return new Promise<void>((resolve, reject) => {
      let attempts = 0;
      const ping = () => {
        fetch(url)
          .then((response) => {
            if (response.ok) {
              setStatus("Connection Established");
              resolve();
            } else {
              throw new Error("Network response was not ok");
            }
          })
          .catch(() => {
            if (attempts < retries) {
              attempts++;
              setTimeout(ping, interval);
            } else {
              setStatus("No Connection to Sensor");
              reject(new Error("No Connection to Sensor"));
            }
          });
      };
      ping();
    });
  }, [url, retries, interval]);

  useEffect(() => {
    setStatus("Connecting...");
    toast.promise(checkConnection, {
      loading: `Connecting to ${url}`,
      success: `Connection Established to ${url}`,
      error: "No Connection to Sensor",
    });
  }, [checkConnection, url]);
  return status;
};

const App: React.FC = () => {
  const [data, setData] = useState<ThermalData | null>(null);
  const [lastRefreshed, setLastRefreshed] = useState<Date>(new Date());
  const [config, setConfig] = useState(getDefaultConfig());
  const [isDialogOpen, setIsDialogOpen] = useState<boolean>(false);
  const [isConnected, setIsConnected] = useState<boolean>(true);

  const fetchData = async () => {
    if (
      !config.apiUrl ||
      !config.apiUrl.startsWith("http") ||
      !config.apiUrl.includes("thermal_data")
    )
      return;

    setLastRefreshed(new Date());
    try {
      const response = await axios.get<ThermalData>(config.apiUrl);
      setData(response.data);
      setIsConnected(true);
    } catch (error) {
      console.error("Error fetching thermal data:", error);
      setIsConnected(false);
    }
  };

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

  const connectionStatus = useCheckConnection(config.apiUrl, 5, 2000);

  useEffect(() => {
    setIsConnected(connectionStatus === "Connection Established");
  }, [connectionStatus]);

  useEffect(() => {
    if (connectionStatus === "Connection Established") {
      fetchData();
      const interval = setInterval(fetchData, 300);
      return () => clearInterval(interval);
    }
  }, [connectionStatus, config.apiUrl]);

  return (
    <div className="flex flex-col gap-2">
      <div className="print:hidden">
        <Indicator
          title="High Fever"
          amount={highFeverDetected ? "Detected" : "Not Detected"}
          lastRefreshed={lastRefreshed || undefined}
        />
      </div>
      <div className="grid grid-cols-1 gap-2 md:grid-cols-3 print:hidden">
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
      {isConnected && data ? (
        <>
          <Card className="w-full print:hidden">
            <CardHeader>
              <h1 className="text-lg font-medium md:text-xl">
                Realtime Live Heatmap of Thermal Camera
              </h1>
              <p>Fever Detection using Thermal Sensing for Brooding Chicks</p>
            </CardHeader>
            <CardContent className="flex items-center justify-center w-full h-full">
              <ThermalHeatmap data={data} blurRadius={config.blurRadius} />
            </CardContent>
          </Card>
        </>
      ) : (
        <div className="flex flex-col items-center justify-center gap-2 print:hidden">
          <TriangleAlert className="text-red-500" />
          <Badge className="print:hidden" variant="destructive">
            {status}
          </Badge>
        </div>
      )}
      <RealTimeTemperatureChart />
      <div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button className="print:hidden" variant="outline">
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
