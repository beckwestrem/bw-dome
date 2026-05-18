export type UploadProgressPhase = "uploading" | "processing";

export type UploadJsonResult = {
  ok: boolean;
  status: number;
  json: Record<string, unknown>;
};

/**
 * POST multipart form with cookie credentials. Reports upload byte progress via XHR;
 * after the body is sent, `onPhase` becomes `processing` until the response arrives.
 */
export function postFormDataWithUploadProgress(
  url: string,
  formData: FormData,
  onUploadPercent: (pct: number | null) => void,
  onPhase: (phase: UploadProgressPhase) => void,
): Promise<UploadJsonResult> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", url);
    xhr.withCredentials = true;
    xhr.responseType = "json";

    onPhase("uploading");
    onUploadPercent(0);

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && e.total > 0) {
        const pct = Math.min(100, Math.round((100 * e.loaded) / e.total));
        onUploadPercent(pct);
      } else {
        onUploadPercent(null);
      }
    };

    xhr.upload.onload = () => {
      onUploadPercent(100);
      onPhase("processing");
    };

    xhr.onload = () => {
      let json: unknown = xhr.response;
      if (typeof xhr.response === "string") {
        try {
          json = JSON.parse(xhr.response) as Record<string, unknown>;
        } catch {
          json = {};
        }
      }
      if (json === null || typeof json !== "object") {
        json = {};
      }
      resolve({
        ok: xhr.status >= 200 && xhr.status < 300,
        status: xhr.status,
        json: json as Record<string, unknown>,
      });
    };

    xhr.onerror = () => reject(new Error("Network error"));
    xhr.ontimeout = () => reject(new Error("Request timed out"));
    xhr.timeout = 180000;

    xhr.send(formData);
  });
}
