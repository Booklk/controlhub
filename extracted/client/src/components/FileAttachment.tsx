import { useState, useCallback, useRef } from "react";
import { apiRequest } from "@/lib/queryClient";
import { getAuthToken } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogBody } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import {
  Upload, Download, Eye, Trash2, FileText, Image,
  FileVideo, FileAudio, File, X, Check, Loader2,
  Paperclip, Plus, FileSpreadsheet, FileCode, Archive,
  Presentation, AlertCircle
} from "lucide-react";

export interface FileAttachmentData {
  name: string;
  url: string;
  size: number;
  type: string;
  uploadedAt?: string;
  uploadedBy?: string;
  uploadedByDept?: string;
  note?: string;
}

interface FileAttachmentProps {
  attachments: FileAttachmentData[];
  onAttachmentsChange?: (attachments: FileAttachmentData[]) => void;
  maxFiles?: number;
  maxFileSize?: number;
  allowedTypes?: string[];
  readonly?: boolean;
  className?: string;
  label?: string;
  uploadedBy?: string;
  uploadedByDept?: string;
  compact?: boolean;
  dark?: boolean;
}

const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return "0 بايت";
  const k = 1024;
  const sizes = ["بايت", "ك.ب", "م.ب", "ج.ب"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
};

const getFileIcon = (type: string, name?: string) => {
  const ext = name?.split(".").pop()?.toLowerCase() || "";
  if (type.startsWith("image/")) return <Image className="w-4 h-4" />;
  if (type.startsWith("video/")) return <FileVideo className="w-4 h-4" />;
  if (type.startsWith("audio/")) return <FileAudio className="w-4 h-4" />;
  if (type.includes("pdf")) return <FileText className="w-4 h-4 text-red-500" />;
  if (type.includes("word") || ext === "doc" || ext === "docx")
    return <FileText className="w-4 h-4 text-blue-600" />;
  if (type.includes("excel") || type.includes("spreadsheet") || ext === "xls" || ext === "xlsx")
    return <FileSpreadsheet className="w-4 h-4 text-green-600" />;
  if (type.includes("powerpoint") || type.includes("presentation") || ext === "ppt" || ext === "pptx")
    return <Presentation className="w-4 h-4 text-orange-500" />;
  if (type.includes("zip") || type.includes("rar") || type.includes("7z") || ext === "zip" || ext === "rar")
    return <Archive className="w-4 h-4 text-yellow-600" />;
  if (type.startsWith("text/") || ext === "txt" || ext === "csv")
    return <FileCode className="w-4 h-4 text-gray-500" />;
  return <File className="w-4 h-4" />;
};

const getFileBgColor = (type: string, name?: string) => {
  const ext = name?.split(".").pop()?.toLowerCase() || "";
  if (type.startsWith("image/")) return "bg-purple-50 border-purple-200";
  if (type.includes("pdf")) return "bg-red-50 border-red-200";
  if (type.includes("word") || ext === "doc" || ext === "docx") return "bg-blue-50 border-blue-200";
  if (type.includes("excel") || ext === "xls" || ext === "xlsx") return "bg-green-50 border-green-200";
  if (type.includes("powerpoint") || ext === "ppt" || ext === "pptx") return "bg-orange-50 border-orange-200";
  if (type.includes("zip") || ext === "zip" || ext === "rar") return "bg-yellow-50 border-yellow-200";
  return "bg-slate-50 border-slate-200";
};

const isPreviewable = (type: string): boolean =>
  type.startsWith("image/") || type.includes("pdf");

export function FileAttachment({
  attachments,
  onAttachmentsChange,
  maxFiles = 10,
  maxFileSize = 20 * 1024 * 1024,
  allowedTypes,
  readonly = false,
  className,
  label,
  uploadedBy,
  uploadedByDept,
  compact = false,
  dark = false,
}: FileAttachmentProps) {
  const { toast } = useToast();
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadingFile, setUploadingFile] = useState<string>("");
  const [previewFile, setPreviewFile] = useState<FileAttachmentData | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Theme helper: picks class based on dark prop
  const th = (light: string, d: string) => dark ? d : light;

  const uploadFile = async (file: File): Promise<FileAttachmentData | null> => {
    if (file.size > maxFileSize) {
      toast({
        title: "حجم الملف كبير جداً",
        description: `الحد الأقصى ${formatFileSize(maxFileSize)}، حجم الملف: ${formatFileSize(file.size)}`,
        variant: "destructive",
      });
      return null;
    }

    if (allowedTypes && !allowedTypes.some(t => file.type.includes(t) || file.name.endsWith(t))) {
      toast({
        title: "نوع ملف غير مدعوم",
        description: `الأنواع المدعومة: ${allowedTypes.join("، ")}`,
        variant: "destructive",
      });
      return null;
    }

    try {
      setUploadingFile(file.name);
      const urlResponse = await apiRequest("POST", "/api/uploads/request-url", {
        name: file.name, size: file.size, contentType: file.type,
      });

      if (!urlResponse.ok) throw new Error("فشل في الحصول على رابط الرفع");
      const { uploadURL, objectPath } = await urlResponse.json();

      const uploadResponse = await fetch(uploadURL, {
        method: "PUT",
        body: file,
        headers: { "Content-Type": file.type },
      });

      if (!uploadResponse.ok) throw new Error("فشل في رفع الملف");

      return {
        name: file.name,
        url: objectPath,
        size: file.size,
        type: file.type,
        uploadedAt: new Date().toISOString(),
        uploadedBy,
        uploadedByDept,
      };
    } catch {
      toast({
        title: "فشل رفع الملف",
        description: file.name,
        variant: "destructive",
      });
      return null;
    }
  };

  const handleFiles = useCallback(async (files: FileList | File[]) => {
    const fileArray = Array.from(files);
    if (attachments.length + fileArray.length > maxFiles) {
      toast({
        title: "تجاوز الحد الأقصى",
        description: `الحد الأقصى ${maxFiles} ملفات`,
        variant: "destructive",
      });
      return;
    }

    setUploading(true);
    setUploadProgress(0);
    const newAttachments: FileAttachmentData[] = [];

    for (let i = 0; i < fileArray.length; i++) {
      setUploadProgress(Math.round((i / fileArray.length) * 100));
      const result = await uploadFile(fileArray[i]);
      if (result) newAttachments.push(result);
    }

    setUploadProgress(100);

    if (newAttachments.length > 0 && onAttachmentsChange) {
      onAttachmentsChange([...attachments, ...newAttachments]);
      toast({
        title: `✅ تم رفع ${newAttachments.length} ملف بنجاح`,
      });
    }

    setUploading(false);
    setUploadProgress(0);
    setUploadingFile("");
    if (inputRef.current) inputRef.current.value = "";
  }, [attachments, maxFiles, maxFileSize, allowedTypes, onAttachmentsChange, uploadedBy, uploadedByDept, toast]);

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) handleFiles(e.target.files);
  }, [handleFiles]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!readonly && !uploading) setIsDragOver(true);
  }, [readonly, uploading]);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
    if (readonly || uploading) return;
    const files = e.dataTransfer.files;
    if (files.length > 0) handleFiles(files);
  }, [readonly, uploading, handleFiles]);

  const handleRemoveFile = useCallback((index: number) => {
    if (onAttachmentsChange) {
      const newAttachments = [...attachments];
      newAttachments.splice(index, 1);
      onAttachmentsChange(newAttachments);
    }
  }, [attachments, onAttachmentsChange]);

  const handleDownload = useCallback((file: FileAttachmentData) => {
    const link = document.createElement("a");
    link.href = file.url;
    link.download = file.name;
    link.target = "_blank";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }, []);

  return (
    <div className={cn("space-y-3", className)} dir="rtl">
      {label && (
        <div className={cn("flex items-center gap-2 text-sm font-semibold", th("text-foreground", "text-white"))}>
          <Paperclip className="w-4 h-4 hub-stat-gold" />
          <span>{label}</span>
          {attachments.length > 0 && (
            <span className={cn("text-xs px-1.5 py-0.5 rounded-full font-medium", th("bg-gold/20 text-navy", "bg-gold/20 text-gold"))}>
              {attachments.length}
            </span>
          )}
        </div>
      )}

      {/* Drop Zone */}
      {!readonly && (
        <div
          className={cn(
            "relative rounded-xl border-2 border-dashed transition-all duration-200 cursor-pointer",
            isDragOver
              ? "border-gold bg-gold/10 scale-[1.01]"
              : uploading
              ? th("border-navy/20 bg-muted/20", "border-white/10 bg-white/5")
              : th("border-gold/30 bg-muted/20 hover:border-gold/60 hover:bg-gold/5",
                  "border-gold/30 bg-white/5 hover:border-gold/60 hover:bg-gold/5")
          )}
          onDragOver={handleDragOver}
          onDragEnter={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => !uploading && inputRef.current?.click()}
          data-testid="dropzone-file-upload"
        >
          <input
            ref={inputRef}
            type="file"
            multiple
            onChange={handleInputChange}
            className="hidden"
            disabled={uploading || attachments.length >= maxFiles}
            accept={allowedTypes?.join(",")}
            data-testid="input-file-upload"
          />

          {uploading ? (
            <div className="flex flex-col items-center gap-3 p-6">
              <Loader2 className="w-8 h-8 hub-stat-gold animate-spin" />
              <div className="w-full max-w-xs space-y-1.5">
                <Progress value={uploadProgress} className="h-2" />
                <p className={cn("text-xs text-center", th("text-muted-foreground", "text-white/50"))}>
                  {uploadingFile ? `جاري رفع "${uploadingFile}"...` : `جاري الرفع... ${uploadProgress}%`}
                </p>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center gap-4 p-6">
              <div className={cn(
                "p-3 rounded-full border-2 transition-colors",
                isDragOver ? "border-gold bg-gold/20" : "border-gold/30 bg-gold/10"
              )}>
                <Upload className={cn("w-6 h-6", isDragOver ? "text-gold" : "hub-stat-gold")} />
              </div>
              <div>
                <p className={cn("font-semibold text-sm", th("text-foreground", "text-white"))}>
                  {isDragOver ? "أفلت الملفات هنا" : "اسحب الملفات هنا أو اضغط للاختيار"}
                </p>
                <p className={cn("text-xs mt-0.5", th("text-muted-foreground", "text-white/50"))}>
                  الحد الأقصى: {formatFileSize(maxFileSize)} لكل ملف · حتى {maxFiles} ملفات
                </p>
                {allowedTypes && (
                  <p className={cn("text-xs mt-0.5", th("text-muted-foreground/70", "text-white/40"))}>
                    الأنواع: {allowedTypes.join("، ")}
                  </p>
                )}
              </div>
            </div>
          )}

          {attachments.length >= maxFiles && !uploading && (
            <div className={cn("absolute inset-0 rounded-xl flex items-center justify-center", th("bg-muted/60", "bg-white/10"))}>
              <div className={cn("flex items-center gap-2 text-sm", th("text-muted-foreground", "text-white/60"))}>
                <AlertCircle className="w-4 h-4" />
                <span>وصلت للحد الأقصى ({maxFiles} ملفات)</span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* File List */}
      {attachments.length > 0 && (
        <div className="space-y-2">
          {!label && (
            <div className={cn("flex items-center gap-2 text-xs font-medium", th("text-muted-foreground", "text-white/60"))}>
              <Paperclip className="w-3.5 h-3.5" />
              <span>المرفقات ({attachments.length})</span>
            </div>
          )}

          <div className={cn(
            compact ? "flex flex-wrap gap-2" : "space-y-2"
          )}>
            {attachments.map((file, index) => (
              compact ? (
                <div
                  key={`${file.name}-${index}`}
                  className={cn("inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-xs transition-colors",
                    th("bg-muted border border-border hover:bg-muted/80", "bg-white/10 border border-white/15 hover:bg-white/15 text-white"))}
                  data-testid={`file-chip-${index}`}
                >
                  {getFileIcon(file.type, file.name)}
                  <span className="max-w-[120px] truncate font-medium">{file.name}</span>
                  <button
                    onClick={() => handleDownload(file)}
                    className="hover:text-gold transition-colors"
                  >
                    <Download className="w-3 h-3" />
                  </button>
                  {!readonly && (
                    <button
                      onClick={() => handleRemoveFile(index)}
                      className="hover:text-red-500 transition-colors"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>
              ) : (
                <div
                  key={`${file.name}-${index}`}
                  className={cn(
                    "flex items-center gap-3 p-3 rounded-xl border transition-all hover:shadow-sm",
                    dark ? "bg-white/5 border-white/10 hover:bg-white/8" : getFileBgColor(file.type, file.name)
                  )}
                  data-testid={`file-attachment-${index}`}
                >
                  {/* Icon */}
                  <div className={cn("w-9 h-9 rounded-lg flex items-center justify-center shrink-0 shadow-sm",
                    th("bg-white border border-border/50", "bg-white/10 border border-white/10"))}>
                    {getFileIcon(file.type, file.name)}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <p className={cn("font-medium text-sm truncate", th("text-foreground", "text-white"))}>{file.name}</p>
                    <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                      <span className={cn("text-xs", th("text-muted-foreground", "text-white/50"))}>{formatFileSize(file.size)}</span>
                      {file.uploadedBy && (
                        <>
                          <span className={cn("text-xs", th("text-muted-foreground/40", "text-white/30"))}>·</span>
                          <span className={cn("text-xs", th("text-muted-foreground", "text-white/50"))}>{file.uploadedBy}</span>
                        </>
                      )}
                      {file.uploadedByDept && (
                        <>
                          <span className={cn("text-xs", th("text-muted-foreground/40", "text-white/30"))}>·</span>
                          <span className={cn("text-xs px-1.5 py-0.5 rounded", th("bg-navy/10 text-navy", "bg-white/20 text-white"))}>{file.uploadedByDept}</span>
                        </>
                      )}
                      {file.uploadedAt && (
                        <>
                          <span className={cn("text-xs", th("text-muted-foreground/40", "text-white/30"))}>·</span>
                          <span className={cn("text-xs", th("text-muted-foreground", "text-white/50"))}>
                            {new Date(file.uploadedAt).toLocaleDateString("ar-SA")}
                          </span>
                        </>
                      )}
                    </div>
                    {file.note && (
                      <p className={cn("text-xs mt-0.5 italic", th("text-muted-foreground", "text-white/40"))}>{file.note}</p>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1 shrink-0">
                    {isPreviewable(file.type) && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className={cn("h-7 w-7 hub-stat-gold", th("hover:bg-white/80", "hover:bg-white/10"))}
                        onClick={() => { setPreviewFile(file); setPreviewOpen(true); }}
                        data-testid={`button-preview-${index}`}
                        title="معاينة"
                      >
                        <Eye className="w-3.5 h-3.5" />
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      className={cn("h-7 w-7 hub-stat-gold", th("hover:bg-white/80", "hover:bg-white/10"))}
                      onClick={() => handleDownload(file)}
                      data-testid={`button-download-${index}`}
                      title="تحميل"
                    >
                      <Download className="w-3.5 h-3.5" />
                    </Button>
                    {!readonly && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className={cn("h-7 w-7", th("hover:bg-red-50 hover:text-red-500", "hover:bg-red-500/10 hover:text-red-400"))}
                        onClick={() => handleRemoveFile(index)}
                        data-testid={`button-remove-${index}`}
                        title="حذف"
                      >
                        <X className="w-3.5 h-3.5" />
                      </Button>
                    )}
                  </div>
                </div>
              )
            ))}
          </div>
        </div>
      )}

      {/* Empty state (readonly) */}
      {readonly && attachments.length === 0 && (
        <div className={cn("flex items-center gap-2 p-3 rounded-lg border border-dashed",
          th("bg-muted/30 border-muted-foreground/20", "bg-white/5 border-white/15"))}>
          <Paperclip className={cn("w-4 h-4", th("text-muted-foreground/50", "text-white/30"))} />
          <span className={cn("text-xs", th("text-muted-foreground", "text-white/50"))}>لا توجد مرفقات</span>
        </div>
      )}

      {/* Preview Dialog */}
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Eye className="w-5 h-5 hub-stat-gold" />
              {previewFile?.name}
              <span className="text-xs text-muted-foreground font-normal">
                ({previewFile && formatFileSize(previewFile.size)})
              </span>
            </DialogTitle>
          </DialogHeader>

          <DialogBody className="flex items-center justify-center min-h-[300px]">
            {previewFile?.type.startsWith("image/") ? (
              <img
                src={previewFile.url}
                alt={previewFile.name}
                className="max-w-full max-h-[70vh] object-contain rounded-lg shadow-md"
              />
            ) : previewFile?.type.includes("pdf") ? (
              <iframe
                src={previewFile.url}
                className="w-full h-[70vh] rounded-lg border"
                title={previewFile.name}
              />
            ) : (
              <div className="text-center text-muted-foreground py-12">
                <File className="w-16 h-16 mx-auto mb-4 opacity-30" />
                <p className="font-medium">لا يمكن معاينة هذا النوع من الملفات</p>
                <p className="text-sm mt-1">يمكنك تحميله لفتحه</p>
              </div>
            )}
          </DialogBody>

          <div className="flex justify-end gap-2 p-6 pt-0">
            <Button variant="outline" onClick={() => setPreviewOpen(false)}>إغلاق</Button>
            {previewFile && (
              <Button
                variant="gold"
                onClick={() => handleDownload(previewFile)}
                className="gap-2"
                data-testid="button-download-preview"
              >
                <Download className="w-4 h-4" />
                تحميل
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Simple single-file upload button ─────────────────────────────────────────
interface SimpleFileUploadProps {
  onUpload: (file: FileAttachmentData) => void;
  uploading?: boolean;
  className?: string;
  buttonText?: string;
  uploadedBy?: string;
  uploadedByDept?: string;
}

export function SimpleFileUpload({
  onUpload,
  uploading = false,
  className,
  buttonText = "إرفاق ملف",
  uploadedBy,
  uploadedByDept,
}: SimpleFileUploadProps) {
  const { toast } = useToast();
  const [isUploading, setIsUploading] = useState(false);

  const handleFileSelect = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    try {
      const uploadAuthToken = getAuthToken();
      const urlResponse = await fetch("/api/uploads/request-url", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(uploadAuthToken ? { "Authorization": `Bearer ${uploadAuthToken}` } : {}),
        },
        credentials: 'include',
        body: JSON.stringify({ name: file.name, size: file.size, contentType: file.type }),
      });

      if (!urlResponse.ok) throw new Error("فشل في الحصول على رابط الرفع");
      const { uploadURL, objectPath } = await urlResponse.json();

      const uploadResponse = await fetch(uploadURL, {
        method: "PUT",
        body: file,
        headers: { "Content-Type": file.type },
      });

      if (!uploadResponse.ok) throw new Error("فشل في رفع الملف");

      onUpload({
        name: file.name,
        url: objectPath,
        size: file.size,
        type: file.type,
        uploadedAt: new Date().toISOString(),
        uploadedBy,
        uploadedByDept,
      });

      toast({ title: "✅ تم رفع الملف بنجاح", description: file.name });
    } catch {
      toast({ title: "فشل رفع الملف", description: "حدث خطأ أثناء رفع الملف", variant: "destructive" });
    } finally {
      setIsUploading(false);
      event.target.value = "";
    }
  }, [onUpload, uploadedBy, uploadedByDept, toast]);

  return (
    <div className={cn("relative inline-block", className)}>
      <input
        type="file"
        onChange={handleFileSelect}
        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
        disabled={isUploading || uploading}
        data-testid="input-simple-file-upload"
      />
      <Button
        variant="outline"
        disabled={isUploading || uploading}
        className="gap-2 border-gold/30"
      >
        {isUploading || uploading
          ? <Loader2 className="w-4 h-4 animate-spin" />
          : <Paperclip className="w-4 h-4" />
        }
        {buttonText}
      </Button>
    </div>
  );
}

// ─── AttachmentList (read-only display) ────────────────────────────────────────
interface AttachmentListProps {
  attachments: FileAttachmentData[];
  readonly?: boolean;
  onRemove?: (index: number) => void;
  compact?: boolean;
  className?: string;
}

export function AttachmentList({
  attachments,
  readonly = true,
  onRemove,
  compact = false,
  className,
}: AttachmentListProps) {
  return (
    <FileAttachment
      attachments={attachments}
      onAttachmentsChange={
        !readonly && onRemove
          ? (next) => {
              const removed = attachments.findIndex(
                (_, i) => !next.includes(attachments[i])
              );
              if (removed !== -1 && onRemove) onRemove(removed);
            }
          : undefined
      }
      readonly={readonly}
      compact={compact}
      className={className}
    />
  );
}

export default FileAttachment;
