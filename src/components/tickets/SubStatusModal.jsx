import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { PauseCircle } from "lucide-react";

export default function SubStatusModal({ open, onClose, onConfirm, column, ticket }) {
  const [selected, setSelected] = useState(null);
  const subStatuses = column?.sub_statuses || [];

  useEffect(() => { if (open) setSelected(null); }, [open]);

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <PauseCircle className="w-4 h-4 text-primary" />
            Mover para "{column?.title}"
          </DialogTitle>
        </DialogHeader>
        <p className="text-xs text-muted-foreground -mt-1">
          Selecione o tipo para o ticket "{ticket?.title}".
          {column?.pauses_sla && " O SLA ficará pausado enquanto o ticket estiver nesta coluna."}
        </p>
        <div className="space-y-1.5">
          {subStatuses.map(ss => (
            <button
              key={ss}
              onClick={() => setSelected(ss)}
              className={`w-full text-left px-3 py-2.5 rounded-lg border text-sm transition-colors ${
                selected === ss
                  ? "border-primary bg-primary/5 text-primary font-medium"
                  : "border-border text-foreground hover:bg-muted"
              }`}
            >
              {ss}
            </button>
          ))}
        </div>
        <div className="flex justify-end gap-2 pt-1">
          <Button variant="outline" size="sm" onClick={onClose}>Cancelar</Button>
          <Button size="sm" disabled={!selected} onClick={() => onConfirm(selected)}>Confirmar</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}