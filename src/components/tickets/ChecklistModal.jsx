import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { CheckCircle2, AlertCircle } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export default function ChecklistModal({ open, onClose, onConfirm, column, ticket }) {
  const [checkedItems, setCheckedItems] = useState({});
  const requiredFields = column?.required_fields || [];

  const handleToggle = (field) => {
    setCheckedItems(prev => ({ ...prev, [field]: !prev[field] }));
  };

  const allChecked = requiredFields.length === 0 || requiredFields.every(field => checkedItems[field]);

  const handleConfirm = () => {
    if (allChecked) {
      onConfirm();
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="bg-[#161830] border-2 border-[#8B5CF6]/30 max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3 text-white">
            <div className="w-10 h-10 rounded-full bg-[#8B5CF6]/20 flex items-center justify-center">
              <CheckCircle2 className="w-5 h-5 text-[#8B5CF6]" />
            </div>
            <div>
              <p className="text-lg">Mover para: {column?.title}</p>
              <p className="text-xs text-gray-500 font-normal mt-1">
                Complete o checklist antes de continuar
              </p>
            </div>
          </DialogTitle>
        </DialogHeader>

        <div className="py-6 space-y-4">
          {requiredFields.length === 0 ? (
            <div className="text-center py-8">
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                className="w-16 h-16 mx-auto rounded-full bg-green-500/20 flex items-center justify-center mb-4"
              >
                <CheckCircle2 className="w-8 h-8 text-green-400" />
              </motion.div>
              <p className="text-gray-400 text-sm">
                Nenhum requisito para esta etapa
              </p>
            </div>
          ) : (
            <>
              <div className="bg-[#0B0D15] rounded-lg p-4 border border-[rgba(139,92,246,0.15)]">
                <p className="text-xs text-gray-500 mb-3">
                  <strong className="text-white">{ticket?.title}</strong>
                </p>
                <div className="space-y-3">
                  <AnimatePresence>
                    {requiredFields.map((field, idx) => (
                      <motion.div
                        key={field}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: idx * 0.1 }}
                        className={`
                          flex items-start gap-3 p-3 rounded-lg transition-all duration-200
                          ${checkedItems[field] 
                            ? "bg-green-500/10 border border-green-500/30" 
                            : "bg-[#161830] border border-[rgba(139,92,246,0.1)] hover:border-[#8B5CF6]/30"
                          }
                        `}
                      >
                        <Checkbox
                          id={`field-${idx}`}
                          checked={checkedItems[field] || false}
                          onCheckedChange={() => handleToggle(field)}
                          className="mt-0.5"
                        />
                        <Label
                          htmlFor={`field-${idx}`}
                          className={`
                            text-sm cursor-pointer flex-1
                            ${checkedItems[field] ? "text-green-400 line-through" : "text-gray-300"}
                          `}
                        >
                          {field}
                        </Label>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </div>
              </div>

              {!allChecked && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex items-center gap-2 text-xs text-yellow-400 bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-3"
                >
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  <span>Complete todos os itens para continuar</span>
                </motion.div>
              )}
            </>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={!allChecked}
            className={`
              ${allChecked 
                ? "bg-[#8B5CF6] hover:bg-[#7C3AED]" 
                : "bg-gray-600 cursor-not-allowed"
              }
            `}
          >
            {allChecked ? "Confirmar Mudança" : "Complete o Checklist"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}