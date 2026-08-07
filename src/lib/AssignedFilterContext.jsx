import React, { createContext, useContext, useState } from "react";
import { useAuth } from "@/lib/AuthContext";

// Contexto único para o filtro "Responsável", compartilhado entre todas as
// telas que possuem esse filtro (Relatórios: Visão Geral / Discriminado /
// Horas-Pagamento; Kanban: Suporte / Implantação).
//
// Guarda apenas o e-mail selecionado — cada tela continua livre para manter
// seus próprios filtros de data, cliente, tipo etc. Só "quem é o responsável
// selecionado" é global, porque é o único filtro que faz sentido ser o mesmo
// em qualquer lugar do sistema ("estou olhando meus próprios tickets").
const AssignedFilterContext = createContext(null);

export function AssignedFilterProvider({ children }) {
  const [assignedFilter, setAssignedFilter] = useState("");

  const { user } = useAuth();
  const myEmail = user?.email || "";

  const isMine = !!myEmail && assignedFilter === myEmail;

  const toggleMine = () => {
    setAssignedFilter((prev) => (prev === myEmail ? "" : myEmail));
  };

  const clearAssignedFilter = () => setAssignedFilter("");

  return (
    <AssignedFilterContext.Provider
      value={{ assignedFilter, setAssignedFilter, isMine, toggleMine, clearAssignedFilter, myEmail }}
    >
      {children}
    </AssignedFilterContext.Provider>
  );
}

export function useAssignedFilter() {
  const ctx = useContext(AssignedFilterContext);
  if (!ctx) {
    // Fallback seguro caso algum componente seja usado fora do provider
    // (ex: em testes isolados) — evita crash, só não sincroniza.
    return {
      assignedFilter: "",
      setAssignedFilter: () => {},
      isMine: false,
      toggleMine: () => {},
      clearAssignedFilter: () => {},
      myEmail: "",
    };
  }
  return ctx;
}
