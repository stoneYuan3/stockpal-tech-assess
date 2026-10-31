// Phones and tablets get the share sheet; a PC gets a plain download, even
// though desktop Chrome can share files too.
export async function shareOrDownload(text: string, fileName: string) {
  const file = new File([text], fileName, { type: "text/plain" });
  const touch = window.matchMedia("(pointer: coarse)").matches;

  if (touch && navigator.canShare?.({ files: [file] })) {
    try {
      // Called before any other await, so it still counts as the user's tap.
      await navigator.share({ files: [file], title: fileName });
      return;
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
    }
  }

  const url = URL.createObjectURL(file);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
