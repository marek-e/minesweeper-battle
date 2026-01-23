export const CheckboxCard = ({
  label,
  id,
  checked,
  onChange,
}: {
  label: string
  id: string
  checked: boolean
  onChange: (checked: boolean) => void
}) => (
  <label
    htmlFor={id}
    className={`flex cursor-pointer items-center gap-4 rounded-lg p-4 transition-colors ${
      checked
        ? 'border-blue-500 bg-blue-600/20'
        : 'border-slate-700 bg-slate-800/50 hover:bg-slate-800'
    } border`}
  >
    <input
      type="checkbox"
      id={id}
      checked={checked}
      onChange={(e) => onChange(e.target.checked)}
      className="h-6 w-6 rounded border-slate-600 bg-slate-700 text-blue-500 focus:ring-blue-600"
    />
    <span className="font-medium text-slate-200">{label}</span>
  </label>
)
