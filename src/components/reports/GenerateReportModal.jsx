import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Info } from "lucide-react";

export const SKIP_MODAL_KEY = "reports_skip_generate_modal";

export default function GenerateReportModal({ open, onOpenChange, onGenerate, onExport }) {
  const [dontShow, setDontShow] = useState(false);

  const persistChoice = () => {
    if (dontShow) localStorage.setItem(SKIP_MODAL_KEY, "1");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-blue-500/10 flex items-center justify-center flex-shrink-0">
              <Info className="w-5 h-5 text-blue-500" />
            </div>
            <DialogTitle className="text-[16px]">Gerar relatório em tela?</DialogTitle>
          </div>
          <DialogDescription className="text-[12px] pt-2">
            Relatórios com períodos grandes podem demorar para carregar em tela.
            Para grandes volumes de dados, recomendamos utilizar a exportação.
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center gap-2">
          <Checkbox id="dont-show-again" checked={dontShow} onCheckedChange={setDontShow} />
          <Label htmlFor="dont-show-again" className="text-[12px] font-normal cursor-pointer">Não exibir novamente</Label>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => { persistChoice(); onOpenChange(false); onGenerate(); }}>
            Gerar em tela
          </Button>
          <Button onClick={() => { persistChoice(); onOpenChange(false); onExport(); }}>
            Exportar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}