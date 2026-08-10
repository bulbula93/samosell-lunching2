type ReviewStarsProps = {
  score: number
  label?: string
  sizeClassName?: string
}

export default function ReviewStars({
  score,
  label = `${score} / 5`,
  sizeClassName = "text-base",
}: ReviewStarsProps) {
  const roundedScore = Math.max(0, Math.min(5, Math.round(score)))

  return (
    <span className={`inline-flex gap-0.5 text-amber-500 ${sizeClassName}`} aria-label={label}>
      {Array.from({ length: 5 }, (_, index) => (
        <span key={index} aria-hidden="true">
          {index < roundedScore ? "★" : "☆"}
        </span>
      ))}
    </span>
  )
}
