import React, { useState, useRef, useEffect, useCallback } from "react";
import { api } from "@/api/apiClient";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Loader2, Eye, Edit3, Trash2, Image, Bold, Italic, Underline } from "lucide-react";

// Mini rich-text field with B/I/U toolbar
function RichField({ value, onChange, placeholder }) {
  const ref = useRef(null);
  const skipSync = useRef(false);

  // Sync from parent only when value truly differs (avoids cursor jump)
  useEffect(() => {
    if (!ref.current) return;
    if (skipSync.current) { skipSync.current = false; return; }
    if (ref.current.innerHTML !== value) {
      ref.current.innerHTML = value || "";
    }
  }, [value]);

  const exec = (cmd, val) => {
    ref.current?.focus();
    document.execCommand(cmd, false, val ?? null);
  };

  const handleInput = () => {
    skipSync.current = true;
    onChange(ref.current.innerHTML);
  };

  return (
    <div className="rounded-lg overflow-hidden border border-border bg-muted/30">
      <div className="flex items-center gap-0.5 px-1.5 py-1 border-b border-border bg-muted/50">
        <button type="button" onMouseDown={(e) => { e.preventDefault(); exec("bold"); }}
          className="w-6 h-6 flex items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
          <Bold className="w-3 h-3" />
        </button>
        <button type="button" onMouseDown={(e) => { e.preventDefault(); exec("italic"); }}
          className="w-6 h-6 flex items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
          <Italic className="w-3 h-3" />
        </button>
        <button type="button" onMouseDown={(e) => { e.preventDefault(); exec("underline"); }}
          className="w-6 h-6 flex items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
          <Underline className="w-3 h-3" />
        </button>
        <div className="w-px h-3 mx-1 bg-border" />
        <label className="w-6 h-6 flex items-center justify-center rounded cursor-pointer text-muted-foreground hover:text-foreground hover:bg-muted transition-colors" title="Cor do texto">
          <span className="text-[9px] font-bold leading-none">A</span>
          <input type="color" className="sr-only" onChange={(e) => exec("foreColor", e.target.value)} />
        </label>
      </div>
      <div
        ref={ref}
        contentEditable
        suppressContentEditableWarning
        onInput={handleInput}
        data-placeholder={placeholder}
        className="px-2.5 py-1.5 text-xs text-foreground outline-none min-h-[28px] empty:before:content-[attr(data-placeholder)] empty:before:text-muted-foreground"
        style={{ fontFamily: "inherit" }}
      />
    </div>
  );
}

// Predefined social icons.
// `svg` é usado apenas na UI do editor (React). Para o HTML do e-mail usamos
// `img` (PNG hospedado via Icons8) porque Gmail/Outlook removem tags <svg>.
const SOCIAL_ICONS = [
  { key: "linkedin",  color: "#0A66C2", label: "LinkedIn",  icons8: "linkedin",  svg: `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="#0A66C2"><path d="M19 3A2 2 0 0 1 21 5V19A2 2 0 0 1 19 21H5A2 2 0 0 1 3 19V5A2 2 0 0 1 5 3H19M18.5 18.5V13.2A3.26 3.26 0 0 0 15.24 9.94C14.39 9.94 13.4 10.46 12.92 11.24V10.13H10.13V18.5H12.92V13.57C12.92 12.8 13.54 12.17 14.31 12.17A1.4 1.4 0 0 1 15.71 13.57V18.5H18.5M6.88 8.56A1.68 1.68 0 0 0 8.56 6.88C8.56 5.95 7.81 5.19 6.88 5.19A1.69 1.69 0 0 0 5.19 6.88C5.19 7.81 5.95 8.56 6.88 8.56M8.27 18.5V10.13H5.5V18.5H8.27Z"/></svg>` },
  { key: "facebook",  color: "#1877F2", label: "Facebook",  icons8: "facebook-new",  svg: `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="#1877F2"><path d="M12 2.04C6.5 2.04 2 6.53 2 12.06C2 17.06 5.66 21.21 10.44 21.96V14.96H7.9V12.06H10.44V9.85C10.44 7.34 11.93 5.96 14.22 5.96C15.31 5.96 16.45 6.15 16.45 6.15V8.62H15.19C13.95 8.62 13.56 9.39 13.56 10.18V12.06H16.34L15.89 14.96H13.56V21.96A10 10 0 0 0 22 12.06C22 6.53 17.5 2.04 12 2.04Z"/></svg>` },
  { key: "instagram", color: "#E4405F", label: "Instagram", icons8: "instagram-new", svg: `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="#E4405F"><path d="M7.8 2H16.2C19.4 2 22 4.6 22 7.8V16.2A5.8 5.8 0 0 1 16.2 22H7.8C4.6 22 2 19.4 2 16.2V7.8A5.8 5.8 0 0 1 7.8 2M7.6 4A3.6 3.6 0 0 0 4 7.6V16.4C4 18.39 5.61 20 7.6 20H16.4A3.6 3.6 0 0 0 20 16.4V7.6C20 5.61 18.39 4 16.4 4H7.6M17.25 5.5A1.25 1.25 0 0 1 18.5 6.75A1.25 1.25 0 0 1 17.25 8A1.25 1.25 0 0 1 16 6.75A1.25 1.25 0 0 1 17.25 5.5M12 7A5 5 0 0 1 17 12A5 5 0 0 1 12 17A5 5 0 0 1 7 12A5 5 0 0 1 12 7M12 9A3 3 0 0 0 9 12A3 3 0 0 0 12 15A3 3 0 0 0 15 12A3 3 0 0 0 12 9Z"/></svg>` },
  { key: "youtube",   color: "#FF0000", label: "YouTube",   icons8: "youtube-play",   svg: `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="#FF0000"><path d="M10 15L15.19 12L10 9V15M21.56 7.17C21.69 7.64 21.78 8.27 21.84 9.07C21.91 9.87 21.94 10.56 21.94 11.16L22 12C22 14.19 21.84 15.8 21.56 16.83C21.31 17.73 20.73 18.31 19.83 18.56C19.36 18.69 18.5 18.78 17.18 18.84C15.88 18.91 14.69 18.94 13.59 18.94L12 19C7.81 19 5.2 18.84 4.17 18.56C3.27 18.31 2.69 17.73 2.44 16.83C2.31 16.36 2.22 15.73 2.16 14.93C2.09 14.13 2.06 13.44 2.06 12.84L2 12C2 9.81 2.16 8.2 2.44 7.17C2.69 6.27 3.27 5.69 4.17 5.44C4.64 5.31 5.5 5.22 6.82 5.16C8.12 5.09 9.31 5.06 10.41 5.06L12 5C16.19 5 18.8 5.16 19.83 5.44C20.73 5.69 21.31 6.27 21.56 7.17Z"/></svg>` },
  { key: "spotify",   color: "#1DB954", label: "Spotify",   icons8: "spotify",   svg: `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="#1DB954"><path d="M17.9 10.9C14.7 9 9.35 8.8 6.3 9.75C5.8 9.9 5.3 9.6 5.15 9.1C5 8.6 5.3 8.1 5.8 7.95C9.35 6.85 15.25 7.1 18.95 9.25C19.4 9.5 19.55 10.1 19.3 10.55C19.05 10.9 18.4 11.1 17.9 10.9M17.8 13.7C17.55 14.05 17.1 14.2 16.75 13.95C14.05 12.3 9.95 11.8 6.8 12.8C6.4 12.9 5.95 12.7 5.85 12.3C5.75 11.9 5.95 11.45 6.35 11.35C10 10.2 14.55 10.75 17.65 12.65C17.95 12.85 18.1 13.35 17.8 13.7M16.6 16.45C16.4 16.75 16.05 16.85 15.75 16.65C13.4 15.2 10.45 14.9 6.95 15.7C6.6 15.8 6.3 15.55 6.2 15.25C6.1 14.9 6.35 14.6 6.65 14.5C10.45 13.65 13.75 14 16.35 15.6C16.7 15.75 16.75 16.15 16.6 16.45M12 2A10 10 0 0 0 2 12A10 10 0 0 0 12 22A10 10 0 0 0 22 12A10 10 0 0 0 12 2Z"/></svg>` },
  { key: "whatsapp",  color: "#25D366", label: "WhatsApp",  icons8: "whatsapp",  svg: `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="#25D366"><path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91C2.13 13.66 2.59 15.36 3.45 16.86L2.05 22L7.3 20.62C8.75 21.41 10.38 21.83 12.04 21.83C17.5 21.83 21.95 17.38 21.95 11.92C21.95 9.27 20.92 6.78 19.05 4.91C17.18 3.03 14.69 2 12.04 2M12.05 3.67C14.25 3.67 16.31 4.53 17.87 6.09C19.42 7.65 20.28 9.72 20.28 11.92C20.28 16.46 16.58 20.15 12.04 20.15C10.56 20.15 9.11 19.76 7.85 19L7.55 18.83L4.43 19.65L5.26 16.61L5.06 16.29C4.24 15 3.8 13.47 3.8 11.91C3.81 7.37 7.51 3.67 12.05 3.67M8.53 7.33C8.37 7.33 8.1 7.39 7.87 7.64C7.65 7.89 7 8.5 7 9.71C7 10.93 7.89 12.1 8 12.27C8.14 12.44 9.76 14.94 12.25 16C12.84 16.27 13.3 16.42 13.66 16.53C14.25 16.72 14.79 16.69 15.22 16.63C15.7 16.56 16.68 16.03 16.89 15.45C17.1 14.87 17.1 14.38 17.04 14.27C16.97 14.17 16.81 14.11 16.56 14C16.31 13.86 15.09 13.26 14.87 13.18C14.64 13.1 14.5 13.06 14.31 13.31C14.15 13.55 13.67 14.11 13.53 14.27C13.38 14.44 13.24 14.46 13 14.34C12.74 14.21 11.94 13.95 11 13.11C10.26 12.45 9.77 11.64 9.62 11.39C9.5 11.15 9.61 11 9.73 10.89C9.84 10.78 10 10.6 10.1 10.45C10.23 10.31 10.27 10.2 10.35 10.04C10.43 9.87 10.39 9.73 10.33 9.61C10.27 9.5 9.77 8.26 9.56 7.77C9.36 7.29 9.16 7.35 9 7.34C8.86 7.34 8.7 7.33 8.53 7.33Z"/></svg>` },
];

// Build the default HTML signature template
function buildSignatureHtml(data) {
  const {
    name = "", title = "", company = "", email = "",
    phone = "", location = "", website = "", logoUrl = "",
    logoWidth = 160, socials = [], customColor = "#7C3AED"
  } = data;

  // Ícones como <img> PNG (email-safe): glifo branco em círculo na cor de destaque.
  // SVG inline é removido por Gmail/Outlook — nunca usar aqui.
  const socialsHtml = socials.length > 0
    ? `<tr><td style="padding-top:8px;">
        ${socials.map(s => {
          const icon = SOCIAL_ICONS.find(i => i.key === s.key);
          if (!icon) return "";
          const href = s.url || "#";
          return `<a href="${href}" target="_blank" style="display:inline-block;margin-right:5px;text-decoration:none;"><img src="https://img.icons8.com/ios-filled/32/ffffff/${icon.icons8}.png" width="16" height="16" alt="${icon.label}" style="display:inline-block;width:16px;height:16px;padding:6px;border-radius:50%;background-color:${customColor};" /></a>`;
        }).join("")}
      </td></tr>`
    : "";

  const logoCell = logoUrl
    ? `<td style="padding-right:18px;vertical-align:middle;">
        <img src="${logoUrl}" width="${logoWidth}" style="display:block;border-radius:6px;" alt="logo" />
      </td>`
    : "";

  const divider = logoUrl
    ? `<td style="padding-right:18px;vertical-align:middle;"><div style="width:1px;height:80px;background:${customColor}40;"></div></td>`
    : "";

  return `<table cellpadding="0" cellspacing="0" style="font-family:Arial,sans-serif;font-size:13px;color:#333;">
  <tr>
    ${logoCell}
    ${divider}
    <td style="vertical-align:middle;">
      <table cellpadding="0" cellspacing="0">
        ${name ? `<tr><td style="font-size:15px;font-weight:700;color:${customColor};padding-bottom:2px;">${name}</td></tr>` : ""}
        ${title ? `<tr><td style="font-size:12px;color:#555;padding-bottom:1px;">${title}</td></tr>` : ""}
        ${company ? `<tr><td style="font-size:13px;color:#555;padding-bottom:4px;">${company}</td></tr>` : ""}
        ${email ? `<tr><td style="padding-bottom:2px;"><a href="mailto:${email}" style="font-size:12px;color:${customColor};text-decoration:underline;">${email}</a></td></tr>` : ""}
        ${location ? `<tr><td style="font-size:12px;color:#666;padding-bottom:2px;">📍 ${location}</td></tr>` : ""}
        ${phone ? `<tr><td style="font-size:12px;color:#666;padding-bottom:2px;">📞 ${phone}</td></tr>` : ""}
        ${website ? `<tr><td style="padding-top:4px;"><a href="${website}" target="_blank" style="font-size:11px;color:${customColor};text-decoration:underline;">${website.replace(/^https?:\/\//, "")}</a></td></tr>` : ""}
        ${socialsHtml}
      </table>
    </td>
  </tr>
</table>`;
}

const DEFAULT_FIELDS = {
  name: "", title: "", company: "", email: "",
  phone: "", location: "", website: "",
  logoUrl: "", logoWidth: 160, customColor: "#7C3AED",
  socials: [],
};

export default function SignatureEditor({ value, onChange, savedFields, onFieldsChange }) {
  const [tab, setTab] = useState("editor");
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const logoRef = useRef(null);

  // Initialize from savedFields (structured data) if available, otherwise defaults
  const [fields, setFields] = useState(() => {
    if (savedFields && typeof savedFields === "object" && Object.keys(savedFields).length > 0) {
      return { ...DEFAULT_FIELDS, ...savedFields };
    }
    return { ...DEFAULT_FIELDS };
  });

  // Re-initialize when savedFields prop changes (e.g. modal reopened)
  const prevSavedRef = useRef(savedFields);
  React.useEffect(() => {
    if (savedFields && savedFields !== prevSavedRef.current) {
      prevSavedRef.current = savedFields;
      setFields({ ...DEFAULT_FIELDS, ...savedFields });
    }
  }, [savedFields]);

  // Sync HTML output whenever fields change
  const updateField = (key, val) => {
    const updated = { ...fields, [key]: val };
    setFields(updated);
    onChange(buildSignatureHtml(updated));
    if (onFieldsChange) onFieldsChange(updated);
  };

  const setF = (key) => (e) => updateField(key, e.target.value);

  const handleLogoUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingLogo(true);
    try {
      const { file_url } = await api.integrations.Core.UploadFile({ file });
      updateField("logoUrl", file_url);
      toast.success("Logo carregado!");
    } catch { toast.error("Erro ao enviar imagem."); }
    setUploadingLogo(false);
  };

  const toggleSocial = (key) => {
    const exists = fields.socials.find(s => s.key === key);
    const updated = exists
      ? fields.socials.filter(s => s.key !== key)
      : [...fields.socials, { key, url: "" }];
    updateField("socials", updated);
  };

  const setSocialUrl = (key, url) => {
    const updated = fields.socials.map(s => s.key === key ? { ...s, url } : s);
    updateField("socials", updated);
  };

  const preview = buildSignatureHtml(fields);
  const hasAnything = fields.name || fields.email || fields.logoUrl;

  return (
    <div className="rounded-xl border border-border overflow-hidden bg-card">
      {/* Tab bar */}
      <div className="flex items-center border-b border-border">
        <button
          onClick={() => setTab("editor")}
          className={`flex items-center gap-1.5 px-4 py-2.5 text-xs font-medium transition-colors ${tab === "editor" ? "text-primary border-b-2 border-primary -mb-px" : "text-muted-foreground hover:text-foreground"}`}>
          <Edit3 className="w-3.5 h-3.5" /> Editar campos
        </button>
        <button
          onClick={() => setTab("preview")}
          className={`flex items-center gap-1.5 px-4 py-2.5 text-xs font-medium transition-colors ${tab === "preview" ? "text-primary border-b-2 border-primary -mb-px" : "text-muted-foreground hover:text-foreground"}`}>
          <Eye className="w-3.5 h-3.5" /> Pré-visualizar
        </button>
      </div>

      {tab === "editor" && (
        <div className="p-4 space-y-4 max-h-[60vh] overflow-y-auto custom-scrollbar">
          {/* Logo */}
          <div>
            <Label className="text-[10px] uppercase tracking-widest text-muted-foreground mb-2 block">Logo / Imagem</Label>
            <div className="flex items-center gap-3">
              {fields.logoUrl ? (
                <div className="relative">
                  <img src={fields.logoUrl} alt="logo" className="h-12 rounded-lg object-contain border border-border" style={{ maxWidth: 120 }} />
                  <button onClick={() => updateField("logoUrl", "")}
                    className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-red-500 flex items-center justify-center">
                    <Trash2 className="w-2.5 h-2.5 text-white" />
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => logoRef.current?.click()}
                  disabled={uploadingLogo}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg border border-dashed border-border text-xs text-muted-foreground hover:text-foreground hover:border-primary transition-colors">
                  {uploadingLogo ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Image className="w-3.5 h-3.5" />}
                  Enviar logo
                </button>
              )}
              <input ref={logoRef} type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} />
              {fields.logoUrl && (
                <div className="flex-1">
                  <Label className="text-[10px] text-muted-foreground mb-1 block">Largura (px)</Label>
                  <Input type="number" value={fields.logoWidth} onChange={setF("logoWidth")}
                    className="h-7 text-xs w-20" />
                </div>
              )}
            </div>
          </div>

          {/* Personal info */}
          <div>
            <Label className="text-[10px] uppercase tracking-widest text-muted-foreground mb-2 block">Informações pessoais</Label>
            <div className="space-y-2">
              {/* Rich fields: B/I/U support */}
              {[
                { key: "name",  label: "Nome completo" },
                { key: "title", label: "Cargo / Título" },
                { key: "company", label: "Empresa" },
              ].map(({ key, label }) => (
                <div key={key}>
                  <Label className="text-[10px] text-muted-foreground mb-1 block">{label}</Label>
                  <RichField
                    value={fields[key] || ""}
                    onChange={(val) => updateField(key, val)}
                    placeholder={label}
                  />
                </div>
              ))}
              {/* Plain fields */}
              <div className="grid grid-cols-2 gap-2 pt-1">
                {[
                  { key: "email",    label: "E-mail",          full: true },
                  { key: "phone",    label: "Telefone",         full: false },
                  { key: "location", label: "Cidade / Local",   full: false },
                  { key: "website",  label: "Site (com https://)", full: true },
                ].map(({ key, label, full }) => (
                  <div key={key} className={full ? "col-span-2" : ""}>
                    <Label className="text-[10px] text-muted-foreground mb-1 block">{label}</Label>
                    <Input
                      value={fields[key] || ""}
                      onChange={setF(key)}
                      placeholder={label}
                      className="h-7 text-xs"
                    />
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Color */}
          <div>
            <Label className="text-[10px] uppercase tracking-widest text-muted-foreground mb-2 block">Cor de destaque</Label>
            <div className="flex items-center gap-3">
              <input type="color" value={fields.customColor}
                onChange={setF("customColor")}
                className="w-8 h-8 rounded cursor-pointer border-0 bg-transparent" />
              <span className="text-xs text-muted-foreground">{fields.customColor}</span>
              <div className="flex gap-1.5">
                {["#7C3AED","#8B5CF6","#3B82F6","#10B981","#F97316","#EF4444","#EC4899","#0A66C2"].map(c => (
                  <button key={c} onClick={() => updateField("customColor", c)}
                    className="w-5 h-5 rounded-full border-2 transition-transform hover:scale-110"
                    style={{ background: c, borderColor: fields.customColor === c ? "white" : "transparent" }} />
                ))}
              </div>
            </div>
          </div>

          {/* Social icons */}
          <div>
            <Label className="text-[10px] uppercase tracking-widest text-muted-foreground mb-2 block">Redes sociais</Label>
            <div className="space-y-2">
              <div className="flex flex-wrap gap-2">
                {SOCIAL_ICONS.map(icon => {
                  const active = !!fields.socials.find(s => s.key === icon.key);
                  return (
                    <button key={icon.key} onClick={() => toggleSocial(icon.key)}
                      className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-xs border transition-all ${active ? "border-primary bg-primary/20 text-foreground" : "border-border text-muted-foreground hover:text-foreground"}`}>
                      <span dangerouslySetInnerHTML={{ __html: icon.svg.replace('width="20" height="20"', 'width="14" height="14"') }} />
                      {icon.label}
                    </button>
                  );
                })}
              </div>
              {/* URL inputs for active socials */}
              {fields.socials.length > 0 && (
                <div className="space-y-1.5 mt-2">
                  {fields.socials.map(s => {
                    const icon = SOCIAL_ICONS.find(i => i.key === s.key);
                    return (
                      <div key={s.key} className="flex items-center gap-2">
                        <span className="w-4 flex-shrink-0" dangerouslySetInnerHTML={{ __html: icon.svg.replace('width="20" height="20"', 'width="14" height="14"') }} />
                        <Input
                          value={s.url || ""}
                          onChange={(e) => setSocialUrl(s.key, e.target.value)}
                          placeholder={`URL do ${icon.label}`}
                          className="h-7 text-xs flex-1"
                        />
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {tab === "preview" && (
        <div className="p-4">
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground mb-3">Como aparecerá nos e-mails</p>
          {!hasAnything ? (
            <div className="text-center py-10 text-muted-foreground">
              <Eye className="w-8 h-8 mx-auto mb-2 opacity-30" />
              <p className="text-xs">Preencha os campos ao lado para ver a prévia</p>
            </div>
          ) : (
            <div className="bg-white rounded-xl p-5 overflow-auto min-h-[100px]">
              <div dangerouslySetInnerHTML={{ __html: preview }} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}