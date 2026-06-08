import { useState } from "react";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import api from "../services/api";
import { UploadCloud, FileText } from "lucide-react";

export default function UploadResume() {
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const nav = useNavigate();

  const submit = async () => {
    if (!file) return toast.error("Choose a PDF first");
    setLoading(true);
    try {
      const fd = new FormData();
      fd.append("resume", file);
      await api.post("/api/candidate/upload-resume", fd, { headers: { "Content-Type": "multipart/form-data" } });
      await api.post("/api/candidate/calculate-ats");
      toast.success("Resume uploaded and scored");
      nav("/ats-result");
    } catch (e) { toast.error(e.response?.data?.message || "Upload failed"); }
    finally { setLoading(false); }
  };

  return (
    <div className="max-w-3xl mx-auto p-8">
      <h1 className="font-display text-3xl font-bold mb-2">Upload your resume</h1>
      <p className="text-slate-500 mb-8">PDF only · max 5 MB · text-based PDFs work best.</p>
      <label htmlFor="resume-input" className="card flex flex-col items-center justify-center cursor-pointer border-2 border-dashed border-slate-300 hover:border-blue py-16 mb-6">
        {file ? <>
          <FileText className="w-10 h-10 text-blue mb-3" />
          <div className="font-semibold">{file.name}</div>
          <div className="text-xs text-slate-500">{(file.size/1024).toFixed(1)} KB</div>
        </> : <>
          <UploadCloud className="w-10 h-10 text-slate-400 mb-3" />
          <div className="font-semibold">Drop or click to choose your resume PDF</div>
          <div className="text-xs text-slate-500">application/pdf · ≤ 5 MB</div>
        </>}
        <input id="resume-input" data-testid="resume-file-input" type="file" accept="application/pdf" className="hidden" onChange={e => setFile(e.target.files[0])} />
      </label>
      <button data-testid="resume-submit" onClick={submit} disabled={loading || !file} className="btn-primary">{loading ? "Uploading..." : "Upload & Score"}</button>
    </div>
  );
}
