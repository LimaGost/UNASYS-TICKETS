import React, { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/api/apiClient";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Send } from "lucide-react";

export default function CommentForm({ ticketId }) {
  const queryClient = useQueryClient();
  const [text, setText] = useState("");
  const [visibleToClient, setVisibleToClient] = useState(false);
  const [saving, setSaving] = useState(false);

  const mutation = useMutation({
    mutationFn: async () => {
      const user = await api.auth.me();
      await api.entities.TicketEvent.create({
        ticket_id: ticketId,
        type: visibleToClient ? "comment_client" : "comment_internal",
        description: text,
        user_email: user.email,
        user_name: user.full_name,
        visible_to_client: visibleToClient,
        email_sent: false,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ticketEvents"] });
      setText("");
      setVisibleToClient(false);
    },
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!text.trim()) return;
    setSaving(true);
    mutation.mutate(undefined, { onSettled: () => setSaving(false) });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <Textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        className="bg-[#111322] border-[rgba(139,92,246,0.2)] text-white min-h-[80px]"
        placeholder="Escreva um comentário..."
      />
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Checkbox
            id="visible"
            checked={visibleToClient}
            onCheckedChange={(v) => setVisibleToClient(v)}
            className="border-[rgba(139,92,246,0.3)] data-[state=checked]:bg-[#8B5CF6]"
          />
          <Label htmlFor="visible" className="text-xs text-gray-500 cursor-pointer">
            Visível para o cliente
          </Label>
        </div>
        <Button type="submit" size="sm" disabled={saving || !text.trim()}
          className="bg-[#8B5CF6] hover:bg-[#7C3AED] text-white gap-1.5">
          <Send className="w-3.5 h-3.5" />
          {saving ? "Enviando..." : "Comentar"}
        </Button>
      </div>
    </form>
  );
}