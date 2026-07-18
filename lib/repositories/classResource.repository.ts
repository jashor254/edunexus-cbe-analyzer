// lib/repositories/classResource.repository.ts
// Owns `class_resources` and `course_materials` exclusively (ADR-0020).

import { BaseRepository } from './base'

export type ClassResourceRow = {
  id: string
  class_id: string
  teacher_id: string
  title: string
  file_path: string
  file_name: string
  file_type: string
  created_at: string
  updated_at: string
}

export type CourseMaterialRow = {
  id: string
  class_id: string
  teacher_id: string
  title: string
  body: string
  link_url: string | null
  created_at: string
  updated_at: string
}

export class ClassResourceRepository extends BaseRepository {
  async createResource(input: {
    classId: string
    teacherId: string
    title: string
    filePath: string
    fileName: string
    fileType: string
  }): Promise<ClassResourceRow> {
    const { data, error } = await this.db
      .from('class_resources')
      .insert({
        class_id: input.classId,
        teacher_id: input.teacherId,
        title: input.title,
        file_path: input.filePath,
        file_name: input.fileName,
        file_type: input.fileType,
      })
      .select()
      .single()
    if (error || !data) throw new Error('Failed to create class resource')
    return data as ClassResourceRow
  }

  async findResourcesByClass(classId: string): Promise<ClassResourceRow[]> {
    const { data, error } = await this.db
      .from('class_resources')
      .select('id, class_id, teacher_id, title, file_path, file_name, file_type, created_at, updated_at')
      .eq('class_id', classId)
      .order('created_at', { ascending: false })
    if (error) throw new Error('Failed to fetch class resources')
    return (data ?? []) as ClassResourceRow[]
  }

  async findResourceById(id: string): Promise<ClassResourceRow | null> {
    const { data } = await this.db
      .from('class_resources')
      .select('id, class_id, teacher_id, title, file_path, file_name, file_type, created_at, updated_at')
      .eq('id', id)
      .maybeSingle()
    return (data as ClassResourceRow) ?? null
  }

  async deleteResource(id: string, teacherId: string): Promise<void> {
    const { error } = await this.db
      .from('class_resources')
      .delete()
      .eq('id', id)
      .eq('teacher_id', teacherId)
    if (error) throw new Error('Failed to delete class resource')
  }

  async createMaterial(input: {
    classId: string
    teacherId: string
    title: string
    body: string
    linkUrl?: string
  }): Promise<CourseMaterialRow> {
    const { data, error } = await this.db
      .from('course_materials')
      .insert({
        class_id: input.classId,
        teacher_id: input.teacherId,
        title: input.title,
        body: input.body,
        link_url: input.linkUrl ?? null,
      })
      .select()
      .single()
    if (error || !data) throw new Error('Failed to create course material')
    return data as CourseMaterialRow
  }

  async findMaterialsByClass(classId: string): Promise<CourseMaterialRow[]> {
    const { data, error } = await this.db
      .from('course_materials')
      .select('id, class_id, teacher_id, title, body, link_url, created_at, updated_at')
      .eq('class_id', classId)
      .order('created_at', { ascending: false })
    if (error) throw new Error('Failed to fetch course materials')
    return (data ?? []) as CourseMaterialRow[]
  }

  async deleteMaterial(id: string, teacherId: string): Promise<void> {
    const { error } = await this.db
      .from('course_materials')
      .delete()
      .eq('id', id)
      .eq('teacher_id', teacherId)
    if (error) throw new Error('Failed to delete course material')
  }
}
