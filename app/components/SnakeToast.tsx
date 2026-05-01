export default function SnakeToast({
  message,
  tone = "success",
}: {
  message: string | null;
  tone?: "success" | "error";
}) {
  if (!message) return null;

  const styles = {
    success: "border-green-200 bg-green-50 text-green-700",
    error: "border-red-200 bg-red-50 text-red-700",
  };

  return (
    <div
      className={`fixed right-5 top-5 z-[60] rounded-2xl border px-5 py-3 text-sm font-semibold shadow-2xl ${styles[tone]}`}
    >
      {message}
    </div>
  );
}