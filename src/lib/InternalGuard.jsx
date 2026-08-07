import React from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/api/apiClient";
import { Navigate } from "react-router-dom";
import { Clock } from "lucide-react";

function AguardandoPermissoes() {
  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: "#080A12" }}>
      <div className="text-center max-w-md px-6">
        <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-5"
          style={{ background: "rgba(139,92,246,0.15)", border: "1px solid rgba(139,92,246,0.3)" }}>
          <Clock className="w-8 h-8" style={{ color: "#a78bfa" }} />
        </div>
        <h1 className="text-xl font-bold text-white mb-2">Aguardando configuração de acesso</h1>
        <p className="text-sm mb-6" style={{ color: "#9ca3af" }}>
          Sua conta foi criada, mas ainda não recebeu permissões de acesso.
          Por favor, aguarde o administrador configurar o seu perfil.
        </p>
        <button
          onClick={() => api.auth.logout()}
          className="px-4 py-2 rounded-lg text-sm font-medium"
          style={{ background: "rgba(255,255,255,0.05)", color: "#9ca3af", border: "1px solid rgba(255,255,255,0.1)" }}>
          Sair
        </button>
      </div>
    </div>
  );
}

export default function InternalGuard({ children }) {
  const { data: user, isLoading } = useQuery({
    queryKey: ["me"],
    queryFn: () => api.auth.me(),
  });

  if (isLoading) return (
    <div className="fixed inset-0 bg-background flex overflow-hidden">
      <div className="w-[220px] flex-shrink-0 bg-card border-r border-border flex flex-col gap-3 p-4">
        <div className="h-5 w-24 bg-muted rounded animate-pulse mb-2" />
        {[80, 60, 70, 60, 75, 55, 65, 60, 80, 50, 65].map((w, i) => (
          <div key={i} className="h-3.5 rounded animate-pulse bg-muted" style={{ width: `${w}%`, animationDelay: `${i * 60}ms` }} />
        ))}
      </div>
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="h-11 border-b border-border bg-card flex items-center px-5 flex-shrink-0">
          <div className="h-3.5 w-36 bg-muted rounded animate-pulse" />
        </div>
        <div className="flex-1 p-6 overflow-hidden">
          <div className="h-5 w-48 bg-muted rounded animate-pulse mb-6" />
          <div className="grid grid-cols-4 gap-4">
            <div className="col-span-2 flex flex-col gap-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="flex flex-col gap-2">
                  <div className="h-3 bg-muted rounded animate-pulse" style={{ width: "80%", animationDelay: `${i * 50}ms` }} />
                  <div className="h-3 bg-muted rounded animate-pulse" style={{ width: "55%", animationDelay: `${i * 50 + 25}ms` }} />
                </div>
              ))}
            </div>
            <div className="flex flex-col gap-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="flex flex-col gap-2">
                  <div className="h-3 bg-muted rounded animate-pulse" style={{ width: "65%", animationDelay: `${i * 50 + 10}ms` }} />
                  <div className="h-3 bg-muted rounded animate-pulse" style={{ width: "50%", animationDelay: `${i * 50 + 35}ms` }} />
                </div>
              ))}
            </div>
            <div className="flex flex-col gap-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="flex flex-col gap-2">
                  <div className="h-3 bg-muted rounded animate-pulse" style={{ width: "70%", animationDelay: `${i * 50 + 20}ms` }} />
                  <div className="h-3 bg-muted rounded animate-pulse" style={{ width: "55%", animationDelay: `${i * 50 + 40}ms` }} />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  // Admin sempre passa
  if (user?.role === "admin") return children;

  // Pega tipo_perfil de onde quer que esteja no objeto
  const tipoPerfil = user?.tipo_perfil || user?.data?.tipo_perfil;

  // Usuário cliente vai para o portal
  if (tipoPerfil === "cliente") {
    return <Navigate to="/portal" replace />;
  }

  // Usuário interno com perfil definido → passa
  if (tipoPerfil === "interno") {
    return children;
  }

  // Sem tipo_perfil definido (novo usuário) → bloquear
  return <AguardandoPermissoes />;
}