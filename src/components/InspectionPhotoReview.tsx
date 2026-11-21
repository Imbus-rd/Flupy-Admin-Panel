import { inspectionPhotoReview, type InspectionReviewPhoto } from "@/lib/inspectionPhotoReview";

export function InspectionPhotoReview({ photo, locale = "es" }: { photo: InspectionReviewPhoto; locale?: string }) {
  if (!photo.inspectorDecision && !photo.inspectorComment) return null;
  const review = inspectionPhotoReview(photo, locale);
  return <div className="mt-2 space-y-2 text-sm">
    <span className={`inline-flex rounded border px-2 py-1 font-semibold ${review.tone}`}>{review.label}</span>
    {review.comment && <p className="whitespace-pre-wrap break-words text-slate-200">{review.comment}</p>}
  </div>;
}
