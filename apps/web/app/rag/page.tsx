"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { 
  Plus, Trash2, Search, UploadCloud, BookOpen, Sparkles, 
  CheckCircle, AlertCircle, FileText, Info, HelpCircle, 
  Check, X, RefreshCw
} from "lucide-react";
import Link from "next/link";
import { AuthGuard } from "@/components/AuthGuard";
import { fetchRagDocuments, uploadRagDocument, toggleAttestRagDocument, deleteRagDocument, type RagDocument } from "@/lib/api";

export default function RagAdminPage() {
  const [documents, setDocuments] = useState<RagDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  
  // Upload States
  const [uploadTitle, setUploadTitle] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ text: string; type: "success" | "error" | "info" } | null>(null);

  // Delete State
  const [confirmDelete, setConfirmDelete] = useState<RagDocument | null>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadDocs = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchRagDocuments();
      setDocuments(data);
    } catch (e) {
      // Tyst fel
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDocs();
  }, [loadDocs]);

  // Drag and drop handlers
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      const ext = file.name.split(".").pop()?.toLowerCase();
      if (["txt", "md", "json", "pdf", "docx", "xlsx"].includes(ext || "")) {
        setSelectedFile(file);
        if (!uploadTitle) {
          // Förifyll titel med filnamn utan extension
          setUploadTitle(file.name.replace(/\.[^/.]+$/, ""));
        }
      } else {
        showStatus("Tillåtna format: .txt, .md, .json, .pdf, .docx, .xlsx", "error");
      }
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      setSelectedFile(file);
      if (!uploadTitle) {
        setUploadTitle(file.name.replace(/\.[^/.]+$/, ""));
      }
    }
  };

  const showStatus = (text: string, type: "success" | "error" | "info") => {
    setStatusMessage({ text, type });
    setTimeout(() => {
      setStatusMessage(null);
    }, 6000);
  };

  const handleUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile || !uploadTitle.trim() || uploading) return;

    setUploading(true);
    showStatus("Laddar upp och indexerar dokument...", "info");

    try {
      const uploaded = await uploadRagDocument(uploadTitle.trim(), selectedFile);
      setDocuments((prev) => [uploaded, ...prev]);
      setSelectedFile(null);
      setUploadTitle("");
      if (fileInputRef.current) fileInputRef.current.value = "";
      showStatus("Dokumentet har laddats upp som Utkast! Kom ihåg att attestera för att aktivera det.", "success");
    } catch (err: any) {
      showStatus(err.message || "Kunde inte ladda upp dokumentet.", "error");
    } finally {
      setUploading(false);
    }
  };

  const handleToggleAttest = async (doc: RagDocument) => {
    try {
      const updated = await toggleAttestRagDocument(doc.id);
      setDocuments((prev) => prev.map((d) => (d.id === doc.id ? updated : d)));
      showStatus(
        updated.is_attested
          ? `Dokumentet '${updated.title}' har godkänts och indexerats i RAG-scopet!`
          : `Dokumentet '${updated.title}' har dragits tillbaka till Utkast och är nu inaktivt i RAG-scopet.`,
        "success"
      );
    } catch (err) {
      showStatus("Kunde inte ändra godkännandestatus.", "error");
    }
  };

  const handleDelete = async (doc: RagDocument) => {
    if (!doc) return;
    try {
      await deleteRagDocument(doc.id);
      setDocuments((prev) => prev.filter((d) => d.id !== doc.id));
      showStatus(`Dokumentet '${doc.title}' har raderats permanent från RAG-scopet.`, "success");
    } catch (err) {
      showStatus("Kunde inte radera dokumentet.", "error");
    } finally {
      setConfirmDelete(null);
    }
  };

  const filtered = documents.filter((doc) => {
    const term = search.toLowerCase();
    return (
      doc.title.toLowerCase().includes(term) ||
      doc.filename.toLowerCase().includes(term) ||
      doc.uploaded_by.toLowerCase().includes(term)
    );
  });

  return (
    <AuthGuard requiredRole="admin">
      <div className="min-h-screen bg-slate-50/50 dark:bg-slate-950/20 font-sans">
        
        {/* Header */}
        <div className="bg-white dark:bg-slate-900 border-b border-gray-200 dark:border-slate-800 px-6 py-4">
          <div className="max-w-5xl mx-auto flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Link href="/" className="text-gray-400 hover:text-gray-600 text-sm">
                ← Tillbaka
              </Link>
              <div className="w-px h-4 bg-gray-200 dark:bg-slate-850" />
              <div className="flex items-center gap-2">
                <BookOpen size={18} className="text-[#D95D39]" />
                <h1 className="text-lg font-bold text-gray-900 dark:text-slate-100">
                  RAG Dokumentkontroll
                </h1>
                <span className="text-xs text-gray-500 bg-gray-150 dark:bg-slate-800 px-2 py-0.5 rounded-full font-semibold">
                  {documents.length} dokument totalt
                </span>
              </div>
            </div>
            
            <button
              onClick={loadDocs}
              className="flex items-center gap-1 text-xs font-semibold px-3 py-2 border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-850 rounded-xl transition text-slate-600 dark:text-slate-300 cursor-pointer"
            >
              <RefreshCw size={12} className={loading ? "animate-spin" : ""} /> Update
            </button>
          </div>
        </div>

        {/* Content Wrapper */}
        <div className="max-w-5xl mx-auto p-6 space-y-6">
          
          {/* Status Toast */}
          {statusMessage && (
            <div
              className={`border rounded-xl px-4 py-3 text-sm flex items-start gap-2.5 shadow-sm transition-all duration-300 ${
                statusMessage.type === "success"
                  ? "bg-green-50 border-green-200 text-green-800 dark:bg-green-950/20 dark:border-green-900/30 dark:text-green-300"
                  : statusMessage.type === "error"
                  ? "bg-red-50 border-red-200 text-red-800 dark:bg-red-950/20 dark:border-red-900/30 dark:text-red-300"
                  : "bg-blue-50 border-blue-200 text-blue-800 dark:bg-blue-950/20 dark:border-blue-900/30 dark:text-blue-300"
              }`}
            >
              {statusMessage.type === "success" ? (
                <CheckCircle size={16} className="shrink-0 mt-0.5" />
              ) : (
                <AlertCircle size={16} className="shrink-0 mt-0.5" />
              )}
              <span>{statusMessage.text}</span>
            </div>
          )}

          {/* GRC Security Info */}
          <div className="bg-[#7E8F7A]/10 border border-[#7E8F7A]/30 rounded-2xl p-4 text-xs md:text-sm text-slate-700 dark:text-slate-350 leading-relaxed shadow-sm">
            <div className="flex items-center gap-1.5 font-bold text-slate-800 dark:text-slate-100 mb-1">
              <Sparkles size={16} className="text-[#D95D39]" />
              Sintari Enterprise GRC Standard:
            </div>
            Dokument som laddas upp i RAG-scopet används för att besvara personalens frågor om applikationen och kontorens lokala rutiner. För att garantera <strong>Zero Hallucination</strong> och legal säkerhet, tillåts assistenten endast läsa dokument som är i statusen <strong className="text-green-600 dark:text-green-400">Attesterad</strong>. Dokument i status <strong className="text-amber-600 dark:text-amber-400">Utkast</strong> är inaktiva och skyddas från RAG-sökning.
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-[1fr_1.8fr] gap-6">
            
            {/* LEFT: Upload Form */}
            <div className="backdrop-blur-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800/80 shadow-md rounded-2xl p-5 h-fit space-y-4">
              <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100 flex items-center gap-1.5 pb-2 border-b border-slate-100 dark:border-slate-850">
                <UploadCloud size={16} className="text-[#D95D39]" />
                Ladda upp nytt dokument
              </h3>

              <form onSubmit={handleUploadSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                    Dokumentets titel *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="T.ex. Rutiner för Moholm-kontoret"
                    value={uploadTitle}
                    onChange={(e) => setUploadTitle(e.target.value)}
                    className="w-full text-xs pl-3 pr-3 py-2 bg-slate-50 dark:bg-slate-950/20 border border-slate-200 dark:border-slate-800 rounded-xl focus:outline-none focus:ring-1 focus:ring-[#D95D39] focus:border-[#D95D39] text-slate-800 dark:text-slate-100 placeholder-slate-450"
                  />
                </div>

                {/* Drag and Drop Zone */}
                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                    Dokumentfil (.txt, .md, .pdf, .docx, .xlsx) *
                  </label>
                  
                  <div
                    onDragOver={handleDragOver}
                    onDrop={handleDrop}
                    onClick={() => fileInputRef.current?.click()}
                    className={`border-2 border-dashed rounded-2xl p-6 text-center cursor-pointer transition-all ${
                      selectedFile 
                        ? "border-green-400/50 bg-green-500/5" 
                        : "border-[#7E8F7A]/30 bg-slate-50/50 hover:bg-slate-100/50 dark:bg-slate-950/10 dark:hover:bg-slate-950/30"
                    }`}
                  >
                    <input
                      type="file"
                      ref={fileInputRef}
                      onChange={handleFileSelect}
                      accept=".txt,.md,.json,.pdf,.docx,.xlsx"
                      className="hidden"
                    />
                    
                    <div className="flex flex-col items-center justify-center space-y-2">
                      <FileText size={28} className={selectedFile ? "text-green-500" : "text-slate-400"} />
                      
                      {selectedFile ? (
                        <div>
                          <p className="text-xs font-bold text-slate-700 dark:text-slate-300 max-w-[200px] truncate mx-auto">
                            {selectedFile.name}
                          </p>
                          <p className="text-[10px] text-slate-400">
                            {(selectedFile.size / 1024.0).toFixed(1)} KB
                          </p>
                        </div>
                      ) : (
                        <div>
                          <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                            Dra och släpp filen här
                          </p>
                          <p className="text-[10px] text-slate-400 mt-0.5">
                            eller klicka för att bläddra (.txt, .md, .pdf, .docx, .xlsx)
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={!selectedFile || !uploadTitle.trim() || uploading}
                    className="w-full flex items-center justify-center gap-1.5 py-2.5 bg-[#D95D39] hover:bg-[#C24D2C] disabled:bg-slate-200 disabled:text-slate-400 dark:disabled:bg-slate-800 dark:disabled:text-slate-600 text-white rounded-xl text-xs font-bold shadow-md hover:shadow-lg disabled:shadow-none transition cursor-pointer"
                  >
                    {uploading ? "Indexerar..." : "Lägg till i RAG-scopet"}
                  </button>
                </div>
              </form>
            </div>

            {/* RIGHT: Document List */}
            <div className="backdrop-blur-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800/80 shadow-md rounded-2xl p-5 space-y-4">
              
              {/* Search bar */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-850 pb-3">
                <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
                  <BookOpen size={16} className="text-[#D95D39]" />
                  Dokumentlista
                </h3>

                <div className="relative max-w-xs w-full">
                  <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-slate-400">
                    <Search size={14} />
                  </span>
                  <input
                    type="text"
                    placeholder="Sök dokument..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="w-full text-xs pl-9 pr-4 py-1.5 bg-slate-50 dark:bg-slate-950/20 border border-slate-200 dark:border-slate-800 rounded-xl focus:outline-none focus:ring-1 focus:ring-[#D95D39] focus:border-[#D95D39] text-slate-800 dark:text-slate-100 placeholder-slate-450"
                  />
                </div>
              </div>

              {/* Inventory list */}
              {loading ? (
                <div className="flex flex-col items-center justify-center py-12">
                  <RefreshCw size={24} className="text-slate-400 animate-spin mb-2" />
                  <p className="text-xs text-slate-500">Laddar dokumentlista...</p>
                </div>
              ) : filtered.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center border border-dashed border-slate-200 dark:border-slate-800 rounded-xl bg-slate-50/25">
                  <Info size={32} className="text-slate-400 mb-2 animate-pulse" />
                  <h4 className="text-xs font-semibold text-slate-700 dark:text-slate-350">
                    Inga dokument matchade sökningen
                  </h4>
                  <p className="text-[10px] text-slate-450 mt-1 max-w-[250px]">
                    Ladda upp dina kontorsinstruktioner till vänster för att lägga till dokument i assistentens RAG-scope.
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-slate-100 dark:border-slate-850 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                        <th className="py-2.5">Dokument</th>
                        <th className="py-2.5">Storlek</th>
                        <th className="py-2.5">Status</th>
                        <th className="py-2.5">Uppladdat av</th>
                        <th className="py-2.5 text-right">Åtgärder</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50 dark:divide-slate-850 text-xs">
                      {filtered.map((doc) => (
                        <tr key={doc.id} className="group hover:bg-slate-50/50 dark:hover:bg-slate-950/10">
                          {/* Title & filename */}
                          <td className="py-3">
                            <div className="font-bold text-slate-800 dark:text-slate-150">
                              {doc.title}
                            </div>
                            <div className="text-[9px] text-slate-400 font-mono mt-0.5 truncate max-w-[150px]">
                              {doc.filename.slice(doc.filename.indexOf("_") + 1)}
                            </div>
                          </td>

                          {/* File size */}
                          <td className="py-3 text-slate-500 font-mono">
                            {doc.file_size_kb} KB
                          </td>

                          {/* GRC Attestation Status */}
                          <td className="py-3">
                            {doc.is_attested ? (
                              <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-green-500/10 text-green-700 dark:text-green-300 border border-green-500/20">
                                <Check size={8} /> Attesterad
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/20">
                                <X size={8} /> Utkast
                              </span>
                            )}
                          </td>

                          {/* Uploader & Date */}
                          <td className="py-3 text-slate-550 dark:text-slate-400">
                            <div>{doc.uploaded_by}</div>
                            <div className="text-[9px] text-slate-400 font-mono mt-0.5">
                              {new Date(doc.uploaded_at).toLocaleDateString("sv-SE")}
                            </div>
                          </td>

                          {/* Actions */}
                          <td className="py-3 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              {/* Attestation toggle button */}
                              <button
                                onClick={() => handleToggleAttest(doc)}
                                className={`text-[10px] font-bold px-2 py-1 rounded-lg border transition-all cursor-pointer ${
                                  doc.is_attested
                                    ? "bg-green-500 text-white border-green-500 hover:bg-green-600"
                                    : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50 dark:bg-slate-800/40 dark:border-slate-700/50 dark:text-slate-300 dark:hover:bg-slate-800"
                                }`}
                              >
                                {doc.is_attested ? "Beviljad" : "Attestera"}
                              </button>

                              {/* Delete button */}
                              <button
                                onClick={() => setConfirmDelete(doc)}
                                className="text-slate-400 hover:text-red-600 dark:hover:text-red-400 p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
                                title="Ta bort"
                              >
                                <Trash2 size={13} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
            
          </div>
        </div>

        {/* Modal: Confirm Delete */}
        {confirmDelete && (
          <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-fade-in">
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-2xl w-full max-w-sm p-6 space-y-4">
              <div className="text-center space-y-2">
                <AlertCircle size={32} className="text-red-500 mx-auto animate-bounce" />
                <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100">
                  Ta bort dokument permanent?
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                  Är du säker på att du vill ta bort <strong>{confirmDelete.title}</strong>? Detta raderar filen permanent och avindexerar den direkt från Sintari-assistentens RAG-scope.
                </p>
              </div>
              
              <div className="flex gap-2">
                <button
                  onClick={() => setConfirmDelete(null)}
                  className="flex-1 py-2 text-xs border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-350 rounded-xl font-bold hover:bg-slate-50 dark:hover:bg-slate-850 cursor-pointer"
                >
                  Avbryt
                </button>
                <button
                  onClick={() => handleDelete(confirmDelete)}
                  className="flex-1 py-2 text-xs bg-red-600 hover:bg-red-700 text-white rounded-xl font-bold shadow-md hover:shadow-lg cursor-pointer"
                >
                  Ja, ta bort permanent
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </AuthGuard>
  );
}
