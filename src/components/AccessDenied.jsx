import React from "react";
import { Link } from "react-router-dom";
import { ShieldOff } from "lucide-react";

export default function AccessDenied() {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-5 bg-destructive/10 border border-destructive/20">
        <ShieldOff className="w-8 h-8 text-destructive" />
      </div>
      <h1 className="text-lg font-bold text-foreground mb-1">Acesso restrito</h1>
      <p className="text-sm text-muted-foreground max-w-sm mb-6">
        Seu perfil não tem permissão para acessar esta área. Fale com o administrador se precisar de acesso.
      </p>
      <Link to="/" className="px-4 py-2 rounded-lg text-sm font-medium bg-primary text-primary-foreground">
        Voltar ao início
      </Link>
    </div>
  );
}