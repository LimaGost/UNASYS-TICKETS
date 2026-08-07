import { api } from "@/api/apiClient";

/**
 * Helper functions para trabalhar com API Metabot de forma simplificada
 */

export const metabotAPI = {
  /**
   * Listar todos os chats com status
   */
  async listChats() {
    const res = await api.functions.invoke("fetchMetabotChats", {
      action: "list",
    });
    return res.data;
  },

  /**
   * Obter detalhes de um chat específico (inclui mensagens)
   */
  async getChat(chatId) {
    const res = await api.functions.invoke("fetchMetabotChats", {
      action: "chat",
      chat_id: chatId,
    });
    return res.data?.data;
  },

  /**
   * Enviar mensagem de texto
   */
  async sendMessage(chatId, message) {
    const res = await api.functions.invoke("fetchMetabotChats", {
      action: "send",
      chat_id: chatId,
      message,
    });
    return res.data?.data;
  },

  /**
   * Enviar mídia (imagem, vídeo, áudio, documento)
   * @param {string} chatId - ID do chat
   * @param {string} mediaUrl - URL da mídia
   * @param {string} mediaType - Tipo: image, video, audio, document
   * @param {string} caption - Legendas opcionais
   */
  async sendMedia(chatId, mediaUrl, mediaType = "image", caption = "") {
    const res = await api.functions.invoke("fetchMetabotChats", {
      action: "send-media",
      chat_id: chatId,
      mediaUrl,
      mediaType,
      caption,
    });
    return res.data?.data;
  },

  /**
   * Enviar contatos
   * @param {string} chatId - ID do chat
   * @param {Array} contacts - [{name, phone, email?, organization?}]
   */
  async sendContacts(chatId, contacts) {
    const res = await api.functions.invoke("fetchMetabotChats", {
      action: "send-contacts",
      chat_id: chatId,
      contacts,
    });
    return res.data?.data;
  },

  /**
   * Enviar botões/action card
   * @param {string} chatId - ID do chat
   * @param {string} title - Título do card
   * @param {string} body - Corpo do card
   * @param {Array} buttons - [{title, id/url}]
   */
  async sendActionCard(chatId, title, body, buttons) {
    const res = await api.functions.invoke("fetchMetabotChats", {
      action: "send-action-card",
      chat_id: chatId,
      title,
      body,
      buttons,
    });
    return res.data?.data;
  },

  /**
   * Obter mensagem específica por ID
   */
  async getMessage(chatId, messageId) {
    const res = await api.functions.invoke("fetchMetabotChats", {
      action: "get-message",
      chat_id: chatId,
      messageId,
    });
    return res.data?.data;
  },

  /**
   * Criar novo chat
   * @param {string} contactNumber - Número do contato (com +55)
   * @param {string} name - Nome do contato
   * @param {string} description - Descrição/notas
   */
  async createChat(contactNumber, name, description = "") {
    const res = await api.functions.invoke("fetchMetabotChats", {
      action: "create-chat",
      contactNumber,
      name,
      description,
    });
    return res.data?.data;
  },

  /**
   * Fechar/finalizar chat
   */
  async closeChat(chatId, reason = "") {
    const res = await api.functions.invoke("fetchMetabotChats", {
      action: "close-chat",
      chat_id: chatId,
      reason,
    });
    return res.data?.data;
  },

  /**
   * Atualizar chat (status, atribuição, notas)
   */
  async updateChat(chatId, { status, assignedTo, notes }) {
    const res = await api.functions.invoke("fetchMetabotChats", {
      action: "update-chat",
      chat_id: chatId,
      status,
      assignedTo,
      notes,
    });
    return res.data?.data;
  },

  /**
   * Testar conexão com Metabot
   */
  async test() {
    const res = await api.functions.invoke("fetchMetabotChats", {
      action: "test",
    });
    return res.data;
  },
};