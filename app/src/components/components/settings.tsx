import { Button } from "@/components/ui/button";
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
import React, { useState } from "react";

interface PSettingsDialog {
  apiUrl: string;
  onSave: (newUrl: string) => void;
}

const SettingsDialog: React.FC<PSettingsDialog> = ({ apiUrl, onSave }) => {
  const [newApiUrl, setNewApiUrl] = useState(apiUrl);

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline">Edit API URL</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Edit API URL</DialogTitle>
          <DialogDescription>
            Change the API endpoint to fetch thermal data.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid items-center grid-cols-4 gap-4">
            <Label htmlFor="apiUrl" className="text-right">
              API URL
            </Label>
            <Input
              id="apiUrl"
              value={newApiUrl}
              onChange={(e) => setNewApiUrl(e.target.value)}
              className="col-span-3"
            />
          </div>
        </div>
        <DialogFooter>
          <Button onClick={() => onSave(newApiUrl)}>Save changes</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default SettingsDialog;
