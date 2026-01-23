export const InputField = ({
  label,
  id,
  max,
  ...props
}: {
  label: string
  max?: number
} & React.ComponentProps<'input'>) => (
  <div className="flex flex-col gap-2">
    <label htmlFor={id} className="text-sm text-slate-400">
      {label}
      {max && <span className="ml-1 text-slate-500">(max: {max})</span>}
    </label>
    <input
      id={id}
      type="number"
      max={max}
      className="w-full rounded-md border border-slate-700 bg-slate-800 px-3 py-2 text-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
      {...props}
    />
  </div>
)
