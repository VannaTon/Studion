
import React, { useState } from 'react';
import { Button } from '../Shared/Button';
import { Class } from '../../types';

interface ClassFormProps {
  initialData?: Class;
  onSubmit: (data: Partial<Class>) => void;
  onCancel: () => void;
}

export const ClassForm: React.FC<ClassFormProps> = ({ initialData, onSubmit, onCancel }) => {
  const [formData, setFormData] = useState({
    name: initialData?.name || '',
    subject: initialData?.subject || '',
    grade: initialData?.grade || '',
    academicYear: initialData?.academicYear || '2023-2024'
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-slate-700">Class Name</label>
        <input 
          required
          type="text" 
          value={formData.name}
          onChange={e => setFormData({...formData, name: e.target.value})}
          className="mt-1 block w-full rounded-md border-slate-300 border p-2 focus:ring-indigo-500 focus:border-indigo-500"
          placeholder="e.g. Physics Section A"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-slate-700">Subject</label>
        <input 
          required
          type="text" 
          value={formData.subject}
          onChange={e => setFormData({...formData, subject: e.target.value})}
          className="mt-1 block w-full rounded-md border-slate-300 border p-2 focus:ring-indigo-500 focus:border-indigo-500"
          placeholder="e.g. Science"
        />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-slate-700">Grade Level</label>
          <input 
            required
            type="text" 
            value={formData.grade}
            onChange={e => setFormData({...formData, grade: e.target.value})}
            className="mt-1 block w-full rounded-md border-slate-300 border p-2 focus:ring-indigo-500 focus:border-indigo-500"
            placeholder="e.g. 10th"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700">Academic Year</label>
          <input 
            required
            type="text" 
            value={formData.academicYear}
            onChange={e => setFormData({...formData, academicYear: e.target.value})}
            className="mt-1 block w-full rounded-md border-slate-300 border p-2 focus:ring-indigo-500 focus:border-indigo-500"
            placeholder="2023-2024"
          />
        </div>
      </div>
      <div className="flex gap-2 justify-end pt-4">
        <Button variant="secondary" type="button" onClick={onCancel}>Cancel</Button>
        <Button variant="primary" type="submit">Save Class</Button>
      </div>
    </form>
  );
};
