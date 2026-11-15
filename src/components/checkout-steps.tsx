const steps = ["Cart", "Review", "Payment"];

export function CheckoutSteps({ current }: { current: 1 | 2 }) {
  return (
    <p aria-label={`Checkout step ${current} of 3`} className="mb-6 text-sm text-[#8d84a3]">
      {steps.map((label, index) => (
        <span key={label}>
          {index > 0 && <span aria-hidden="true"> → </span>}
          <span className={index + 1 === current ? "font-semibold text-[#f5f2fb]" : undefined} aria-current={index + 1 === current ? "step" : undefined}>
            {label}
          </span>
        </span>
      ))}
    </p>
  );
}
