
import { useState } from "react";
import api from "../services/api";

export default function ResumeUpload({ token }) {
  const [file, setFile] = useState(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [resume, setResume] = useState(null);

  function chooseFile(event) {
    const selected = event.target.files?.[0];

    setMessage("");
    setResume(null);

    if (!selected) {
      setFile(null);
      return;
    }

    if (
      selected.type !== "application/pdf" ||
      !selected.name.toLowerCase().endsWith(".pdf")
    ) {
      setFile(null);
      setMessage("Please select a PDF file.");
      event.target.value = "";
      return;
    }

    if (selected.size > 5 * 1024 * 1024) {
      setFile(null);
      setMessage("Maximum file size is 5 MB.");
      event.target.value = "";
      return;
    }

    setFile(selected);
  }

  async function upload(event) {
    event.preventDefault();

    if (!file) {
      setMessage("Choose a PDF resume first.");
      return;
    }

    if (!token) {
      setMessage("Please log in before uploading.");
      return;
    }

    setBusy(true);
    setMessage("");

    try {
      const formData = new FormData();
      formData.append("resume", file);

      const { data } = await api.post("/resume", formData, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      setResume(data.resume);
      setMessage(data.message);
      setFile(null);
      event.currentTarget.reset();
    } catch (error) {
      setMessage(
        error.response?.data?.message || "Resume upload failed"
      );
    } finally {
      setBusy(false);
    }
  }

  async function loadResume() {
    if (!token) {
      setMessage("Please log in first.");
      return;
    }

    try {
      const { data } = await api.get("/resume/me", {
        headers: { Authorization: `Bearer ${token}` },
      });

      setResume(data.resume);
      setMessage("");
    } catch (error) {
      setMessage(
        error.response?.data?.message || "Could not load resume"
      );
    }
  }

  return (
    <section>
      <h2>Upload your resume</h2>
      <p>PDF only, maximum 5 MB.</p>

      <form onSubmit={upload}>
        <label htmlFor="resume-file">Choose resume (PDF)</label>
        <input
          id="resume-file"
          type="file"
          accept=".pdf,application/pdf"
          onChange={chooseFile}
        />

        {file && <p>Selected: {file.name}</p>}

        <button type="submit" disabled={busy || !file}>
          {busy ? "Uploading..." : "Upload resume"}
        </button>
      </form>

      <button type="button" onClick={loadResume}>
        View uploaded resume
      </button>

      {resume && (
        <div>
          <p>{resume.originalName}</p>
          {resume.downloadUrl && (
            <a
              href={resume.downloadUrl}
              target="_blank"
              rel="noreferrer"
            >
              View / Download PDF
            </a>
          )}
          {resume.uploadedAt && (
            <p>
              Uploaded: {new Date(resume.uploadedAt).toLocaleDateString()}
            </p>
          )}
        </div>
      )}

      <p role="status" aria-live="polite">{message}</p>
    </section>
  );
}
