import type { ComplaintDraft } from '../../store/intakeSlice'

export interface FieldSpec {
  name: keyof ComplaintDraft
  label: string
  type?: 'text' | 'date' | 'number' | 'textarea' | 'select'
  options?: string[]
}

export const SECTIONS: { title: string; fields: FieldSpec[] }[] = [
  {
    title: '1. Origin & Customer Details',
    fields: [
      { name: 'complaint_source', label: 'Complaint Source' },
      { name: 'customer_name', label: 'Customer Name' },
    ],
  },
  {
    title: '2. Product & Batch Identification',
    fields: [
      { name: 'product_name', label: 'Product Name' },
      { name: 'product_strength_grade', label: 'Product Strength/Grade' },
      { name: 'batch_lot_number', label: 'Batch/Lot Number' },
      { name: 'manufacturing_date', label: 'Manufacturing Date', type: 'date' },
      { name: 'expiry_date', label: 'Expiry Date', type: 'date' },
      { name: 'quantity_affected', label: 'Quantity Affected', type: 'number' },
    ],
  },
  {
    title: '3. Complaint Details',
    fields: [
      { name: 'complaint_type', label: 'Complaint Type' },
      { name: 'complaint_date', label: 'Complaint Date', type: 'date' },
      { name: 'description', label: 'Detailed Complaint Description', type: 'textarea' },
    ],
  },
  {
    title: '4. Initial Assessment & Priority',
    fields: [
      {
        name: 'initial_severity',
        label: 'Initial Severity',
        type: 'select',
        options: ['Critical', 'Major', 'Minor'],
      },
      { name: 'priority', label: 'Priority', type: 'select', options: ['High', 'Medium', 'Low'] },
    ],
  },
]

const LABELS = new Map(SECTIONS.flatMap((s) => s.fields.map((f) => [f.name, f.label] as const)))

export const fieldLabel = (name: string) => LABELS.get(name as FieldSpec['name']) ?? name

export const complaintNumber = (id: number) => `CC-${String(id).padStart(6, '0')}`

export const statusLabel = (status: string) =>
  status.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
