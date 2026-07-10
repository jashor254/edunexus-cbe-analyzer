export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      academic_reports: {
        Row: {
          assessment_id: string | null
          created_at: string
          id: string
          is_premium_unlocked: boolean | null
          pathway_recommended: string | null
          report_data: Json
          student_id: string | null
          updated_at: string | null
        }
        Insert: {
          assessment_id?: string | null
          created_at?: string
          id?: string
          is_premium_unlocked?: boolean | null
          pathway_recommended?: string | null
          report_data: Json
          student_id?: string | null
          updated_at?: string | null
        }
        Update: {
          assessment_id?: string | null
          created_at?: string
          id?: string
          is_premium_unlocked?: boolean | null
          pathway_recommended?: string | null
          report_data?: Json
          student_id?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      academic_years: {
        Row: {
          created_at: string
          end_date: string
          id: string
          is_current: boolean
          name: string
          school_id: string
          start_date: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          end_date: string
          id?: string
          is_current?: boolean
          name: string
          school_id: string
          start_date: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          end_date?: string
          id?: string
          is_current?: boolean
          name?: string
          school_id?: string
          start_date?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "academic_years_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      academy_cohort_members: {
        Row: {
          cohort_id: string
          created_at: string
          id: string
          joined_at: string
          teacher_id: string
          updated_at: string
        }
        Insert: {
          cohort_id: string
          created_at?: string
          id?: string
          joined_at?: string
          teacher_id: string
          updated_at?: string
        }
        Update: {
          cohort_id?: string
          created_at?: string
          id?: string
          joined_at?: string
          teacher_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "academy_cohort_members_cohort_id_fkey"
            columns: ["cohort_id"]
            isOneToOne: false
            referencedRelation: "academy_cohorts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "academy_cohort_members_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "teachers"
            referencedColumns: ["id"]
          },
        ]
      }
      academy_cohorts: {
        Row: {
          created_at: string
          id: string
          join_code: string
          lead_teacher_id: string
          name: string
          school: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          join_code: string
          lead_teacher_id: string
          name: string
          school?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          join_code?: string
          lead_teacher_id?: string
          name?: string
          school?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "academy_cohorts_lead_teacher_id_fkey"
            columns: ["lead_teacher_id"]
            isOneToOne: false
            referencedRelation: "teachers"
            referencedColumns: ["id"]
          },
        ]
      }
      academy_competencies: {
        Row: {
          category: string
          color: string
          created_at: string
          description: string
          id: string
          label: string
          updated_at: string
        }
        Insert: {
          category: string
          color: string
          created_at?: string
          description: string
          id: string
          label: string
          updated_at?: string
        }
        Update: {
          category?: string
          color?: string
          created_at?: string
          description?: string
          id?: string
          label?: string
          updated_at?: string
        }
        Relationships: []
      }
      academy_evidence: {
        Row: {
          content: string | null
          created_at: string
          description: string
          evidence_type: string
          id: string
          lesson_id: string
          linked_id: string | null
          linked_title: string | null
          teacher_id: string
          updated_at: string
        }
        Insert: {
          content?: string | null
          created_at?: string
          description?: string
          evidence_type: string
          id?: string
          lesson_id: string
          linked_id?: string | null
          linked_title?: string | null
          teacher_id: string
          updated_at?: string
        }
        Update: {
          content?: string | null
          created_at?: string
          description?: string
          evidence_type?: string
          id?: string
          lesson_id?: string
          linked_id?: string | null
          linked_title?: string | null
          teacher_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "academy_evidence_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "academy_lessons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "academy_evidence_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "teachers"
            referencedColumns: ["id"]
          },
        ]
      }
      academy_lessons: {
        Row: {
          competency_tags: string[]
          content: string
          created_at: string
          id: string
          learning_objective: string | null
          module_id: string | null
          order: number
          practice_link: string | null
          practice_prompt: string | null
          title: string
        }
        Insert: {
          competency_tags?: string[]
          content?: string
          created_at?: string
          id?: string
          learning_objective?: string | null
          module_id?: string | null
          order: number
          practice_link?: string | null
          practice_prompt?: string | null
          title: string
        }
        Update: {
          competency_tags?: string[]
          content?: string
          created_at?: string
          id?: string
          learning_objective?: string | null
          module_id?: string | null
          order?: number
          practice_link?: string | null
          practice_prompt?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "academy_lessons_module_id_fkey"
            columns: ["module_id"]
            isOneToOne: false
            referencedRelation: "academy_modules"
            referencedColumns: ["id"]
          },
        ]
      }
      academy_mission_completions: {
        Row: {
          ai_score: number | null
          ai_verdict: string | null
          comparison_notes: string | null
          completed_at: string
          id: string
          mission_id: string
          self_scores: Json | null
          teacher_id: string
          tool_a_output: string | null
          tool_b_output: string | null
          updated_at: string
        }
        Insert: {
          ai_score?: number | null
          ai_verdict?: string | null
          comparison_notes?: string | null
          completed_at?: string
          id?: string
          mission_id: string
          self_scores?: Json | null
          teacher_id: string
          tool_a_output?: string | null
          tool_b_output?: string | null
          updated_at?: string
        }
        Update: {
          ai_score?: number | null
          ai_verdict?: string | null
          comparison_notes?: string | null
          completed_at?: string
          id?: string
          mission_id?: string
          self_scores?: Json | null
          teacher_id?: string
          tool_a_output?: string | null
          tool_b_output?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "academy_mission_completions_mission_id_fkey"
            columns: ["mission_id"]
            isOneToOne: false
            referencedRelation: "academy_missions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "academy_mission_completions_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "teachers"
            referencedColumns: ["id"]
          },
        ]
      }
      academy_missions: {
        Row: {
          created_at: string
          description: string
          evaluation_rubric: Json | null
          id: string
          instructions: string
          mission_type: string
          module_id: string
          order: number
          phase: number
          published: boolean
          title: string
          tool_a_label: string | null
          tool_a_prompt: string | null
          tool_b_label: string | null
          tool_b_link: string | null
          updated_at: string
          xp_reward: number
        }
        Insert: {
          created_at?: string
          description: string
          evaluation_rubric?: Json | null
          id?: string
          instructions?: string
          mission_type: string
          module_id: string
          order?: number
          phase: number
          published?: boolean
          title: string
          tool_a_label?: string | null
          tool_a_prompt?: string | null
          tool_b_label?: string | null
          tool_b_link?: string | null
          updated_at?: string
          xp_reward?: number
        }
        Update: {
          created_at?: string
          description?: string
          evaluation_rubric?: Json | null
          id?: string
          instructions?: string
          mission_type?: string
          module_id?: string
          order?: number
          phase?: number
          published?: boolean
          title?: string
          tool_a_label?: string | null
          tool_a_prompt?: string | null
          tool_b_label?: string | null
          tool_b_link?: string | null
          updated_at?: string
          xp_reward?: number
        }
        Relationships: [
          {
            foreignKeyName: "academy_missions_module_id_fkey"
            columns: ["module_id"]
            isOneToOne: false
            referencedRelation: "academy_modules"
            referencedColumns: ["id"]
          },
        ]
      }
      academy_module_competencies: {
        Row: {
          competency_id: string
          created_at: string
          id: string
          module_id: string
          updated_at: string
          weight: number
        }
        Insert: {
          competency_id: string
          created_at?: string
          id?: string
          module_id: string
          updated_at?: string
          weight?: number
        }
        Update: {
          competency_id?: string
          created_at?: string
          id?: string
          module_id?: string
          updated_at?: string
          weight?: number
        }
        Relationships: [
          {
            foreignKeyName: "academy_module_competencies_competency_id_fkey"
            columns: ["competency_id"]
            isOneToOne: false
            referencedRelation: "academy_competencies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "academy_module_competencies_module_id_fkey"
            columns: ["module_id"]
            isOneToOne: false
            referencedRelation: "academy_modules"
            referencedColumns: ["id"]
          },
        ]
      }
      academy_modules: {
        Row: {
          color: string | null
          created_at: string
          description: string | null
          estimated_mins: number | null
          id: string
          order: number
          phase: number
          published: boolean
          slug: string
          title: string
        }
        Insert: {
          color?: string | null
          created_at?: string
          description?: string | null
          estimated_mins?: number | null
          id?: string
          order: number
          phase?: number
          published?: boolean
          slug: string
          title: string
        }
        Update: {
          color?: string | null
          created_at?: string
          description?: string | null
          estimated_mins?: number | null
          id?: string
          order?: number
          phase?: number
          published?: boolean
          slug?: string
          title?: string
        }
        Relationships: []
      }
      academy_progress: {
        Row: {
          completed_at: string
          id: string
          lesson_id: string | null
          teacher_id: string | null
        }
        Insert: {
          completed_at?: string
          id?: string
          lesson_id?: string | null
          teacher_id?: string | null
        }
        Update: {
          completed_at?: string
          id?: string
          lesson_id?: string | null
          teacher_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "academy_progress_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "academy_lessons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "academy_progress_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "teachers"
            referencedColumns: ["id"]
          },
        ]
      }
      academy_reflections: {
        Row: {
          ai_feedback: string | null
          created_at: string
          failed: string
          id: string
          lesson_id: string
          module_id: string
          next_action: string
          quality_score: number | null
          surprised: string
          teacher_id: string
          tried: string
          updated_at: string
          word_count: number
          worked: string
        }
        Insert: {
          ai_feedback?: string | null
          created_at?: string
          failed?: string
          id?: string
          lesson_id: string
          module_id: string
          next_action?: string
          quality_score?: number | null
          surprised?: string
          teacher_id: string
          tried?: string
          updated_at?: string
          word_count?: number
          worked?: string
        }
        Update: {
          ai_feedback?: string | null
          created_at?: string
          failed?: string
          id?: string
          lesson_id?: string
          module_id?: string
          next_action?: string
          quality_score?: number | null
          surprised?: string
          teacher_id?: string
          tried?: string
          updated_at?: string
          word_count?: number
          worked?: string
        }
        Relationships: [
          {
            foreignKeyName: "academy_reflections_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "academy_lessons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "academy_reflections_module_id_fkey"
            columns: ["module_id"]
            isOneToOne: false
            referencedRelation: "academy_modules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "academy_reflections_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "teachers"
            referencedColumns: ["id"]
          },
        ]
      }
      academy_xp_events: {
        Row: {
          created_at: string
          event_type: string
          id: string
          metadata: Json | null
          teacher_id: string
          xp_earned: number
        }
        Insert: {
          created_at?: string
          event_type: string
          id?: string
          metadata?: Json | null
          teacher_id: string
          xp_earned: number
        }
        Update: {
          created_at?: string
          event_type?: string
          id?: string
          metadata?: Json | null
          teacher_id?: string
          xp_earned?: number
        }
        Relationships: [
          {
            foreignKeyName: "academy_xp_events_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "teachers"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_call_logs: {
        Row: {
          created_at: string
          error: string | null
          feature: string
          id: string
          latency_ms: number | null
          model: string
          prompt: string | null
          response: string | null
          success: boolean
          token_count: number | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          error?: string | null
          feature: string
          id?: string
          latency_ms?: number | null
          model: string
          prompt?: string | null
          response?: string | null
          success?: boolean
          token_count?: number | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          error?: string | null
          feature?: string
          id?: string
          latency_ms?: number | null
          model?: string
          prompt?: string | null
          response?: string | null
          success?: boolean
          token_count?: number | null
          user_id?: string | null
        }
        Relationships: []
      }
      ai_usage: {
        Row: {
          count: number
          created_at: string
          feature: string
          id: string
          last_used_at: string
          metadata: Json | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          count?: number
          created_at?: string
          feature: string
          id?: string
          last_used_at?: string
          metadata?: Json | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          count?: number
          created_at?: string
          feature?: string
          id?: string
          last_used_at?: string
          metadata?: Json | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      ai_usage_logs: {
        Row: {
          created_at: string
          id: string
          usage_type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          usage_type: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          usage_type?: string
          user_id?: string
        }
        Relationships: []
      }
      app_config: {
        Row: {
          created_at: string
          key: string
          updated_at: string
          value: string
        }
        Insert: {
          created_at?: string
          key: string
          updated_at?: string
          value: string
        }
        Update: {
          created_at?: string
          key?: string
          updated_at?: string
          value?: string
        }
        Relationships: []
      }
      app_metrics: {
        Row: {
          active_teachers: number
          created_at: string
          id: string
          milestone_hit: number | null
          notes: string | null
          recorded_at: string
          total_students: number
          total_teachers: number
          updated_at: string
        }
        Insert: {
          active_teachers?: number
          created_at?: string
          id?: string
          milestone_hit?: number | null
          notes?: string | null
          recorded_at?: string
          total_students?: number
          total_teachers?: number
          updated_at?: string
        }
        Update: {
          active_teachers?: number
          created_at?: string
          id?: string
          milestone_hit?: number | null
          notes?: string | null
          recorded_at?: string
          total_students?: number
          total_teachers?: number
          updated_at?: string
        }
        Relationships: []
      }
      assessment_quality_flags: {
        Row: {
          all_same: boolean | null
          assessment_id: string
          bimodal: boolean | null
          created_at: string
          flagged_at: string
          id: string
          quality: string
          reason: string | null
          teacher_id: string
        }
        Insert: {
          all_same?: boolean | null
          assessment_id: string
          bimodal?: boolean | null
          created_at?: string
          flagged_at?: string
          id?: string
          quality: string
          reason?: string | null
          teacher_id: string
        }
        Update: {
          all_same?: boolean | null
          assessment_id?: string
          bimodal?: boolean | null
          created_at?: string
          flagged_at?: string
          id?: string
          quality?: string
          reason?: string | null
          teacher_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "assessment_quality_flags_assessment_id_fkey"
            columns: ["assessment_id"]
            isOneToOne: true
            referencedRelation: "class_assessments"
            referencedColumns: ["id"]
          },
        ]
      }
      assessments: {
        Row: {
          assessment_style: string | null
          created_at: string
          curriculum_type: string
          grade: number
          grade_level: string | null
          id: string
          mathematics_type: string | null
          pathway_electives: Json | null
          pathway_recommendations: Json | null
          raw_marks: Json | null
          source: string | null
          student_id: string
          subject_marks: Json | null
          subject_scores: Json
          term: number
          updated_at: string | null
          user_id: string | null
          year: number
        }
        Insert: {
          assessment_style?: string | null
          created_at?: string
          curriculum_type?: string
          grade: number
          grade_level?: string | null
          id?: string
          mathematics_type?: string | null
          pathway_electives?: Json | null
          pathway_recommendations?: Json | null
          raw_marks?: Json | null
          source?: string | null
          student_id: string
          subject_marks?: Json | null
          subject_scores?: Json
          term: number
          updated_at?: string | null
          user_id?: string | null
          year: number
        }
        Update: {
          assessment_style?: string | null
          created_at?: string
          curriculum_type?: string
          grade?: number
          grade_level?: string | null
          id?: string
          mathematics_type?: string | null
          pathway_electives?: Json | null
          pathway_recommendations?: Json | null
          raw_marks?: Json | null
          source?: string | null
          student_id?: string
          subject_marks?: Json | null
          subject_scores?: Json
          term?: number
          updated_at?: string | null
          user_id?: string | null
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "assessments_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      assignment_submissions: {
        Row: {
          assignment_id: string
          class_id: string
          compass_session_id: string | null
          compass_summary: string | null
          created_at: string
          id: string
          marked_at: string | null
          score: number | null
          status: string
          student_id: string
          submitted_at: string | null
          teacher_feedback: string | null
          updated_at: string | null
          work_text: string | null
        }
        Insert: {
          assignment_id: string
          class_id: string
          compass_session_id?: string | null
          compass_summary?: string | null
          created_at?: string
          id?: string
          marked_at?: string | null
          score?: number | null
          status?: string
          student_id: string
          submitted_at?: string | null
          teacher_feedback?: string | null
          updated_at?: string | null
          work_text?: string | null
        }
        Update: {
          assignment_id?: string
          class_id?: string
          compass_session_id?: string | null
          compass_summary?: string | null
          created_at?: string
          id?: string
          marked_at?: string | null
          score?: number | null
          status?: string
          student_id?: string
          submitted_at?: string | null
          teacher_feedback?: string | null
          updated_at?: string | null
          work_text?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "assignment_submissions_assignment_id_fkey"
            columns: ["assignment_id"]
            isOneToOne: false
            referencedRelation: "assignments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assignment_submissions_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "teacher_classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assignment_submissions_compass_session_id_fkey"
            columns: ["compass_session_id"]
            isOneToOne: false
            referencedRelation: "compass_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assignment_submissions_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      assignments: {
        Row: {
          class_id: string
          created_at: string
          due_date: string
          holiday_period: string | null
          id: string
          instructions: string
          is_compass_guided: boolean | null
          is_holiday_assignment: boolean | null
          lesson_plan_id: string | null
          max_score: number | null
          status: string
          subject: string
          teacher_id: string
          title: string
          topic: string
          type: string
          updated_at: string | null
        }
        Insert: {
          class_id: string
          created_at?: string
          due_date: string
          holiday_period?: string | null
          id?: string
          instructions: string
          is_compass_guided?: boolean | null
          is_holiday_assignment?: boolean | null
          lesson_plan_id?: string | null
          max_score?: number | null
          status?: string
          subject: string
          teacher_id: string
          title: string
          topic: string
          type?: string
          updated_at?: string | null
        }
        Update: {
          class_id?: string
          created_at?: string
          due_date?: string
          holiday_period?: string | null
          id?: string
          instructions?: string
          is_compass_guided?: boolean | null
          is_holiday_assignment?: boolean | null
          lesson_plan_id?: string | null
          max_score?: number | null
          status?: string
          subject?: string
          teacher_id?: string
          title?: string
          topic?: string
          type?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "assignments_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "teacher_classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assignments_lesson_plan_id_fkey"
            columns: ["lesson_plan_id"]
            isOneToOne: false
            referencedRelation: "lesson_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assignments_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "teachers"
            referencedColumns: ["id"]
          },
        ]
      }
      attention_feed_dismissals: {
        Row: {
          created_at: string
          dismissed_at: string
          id: string
          item_key: string
          teacher_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          dismissed_at?: string
          id?: string
          item_key: string
          teacher_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          dismissed_at?: string
          id?: string
          item_key?: string
          teacher_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "attention_feed_dismissals_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "teachers"
            referencedColumns: ["id"]
          },
        ]
      }
      beta_stats: {
        Row: {
          created_at: string | null
          key: string
          updated_at: string | null
          value: number | null
        }
        Insert: {
          created_at?: string | null
          key: string
          updated_at?: string | null
          value?: number | null
        }
        Update: {
          created_at?: string | null
          key?: string
          updated_at?: string | null
          value?: number | null
        }
        Relationships: []
      }
      bulk_upload_logs: {
        Row: {
          created_at: string | null
          error_log: Json | null
          failed_rows: number | null
          file_name: string | null
          id: string
          school_id: string
          successful_rows: number | null
          total_rows: number | null
          upload_type: string | null
          uploaded_by: string
        }
        Insert: {
          created_at?: string | null
          error_log?: Json | null
          failed_rows?: number | null
          file_name?: string | null
          id?: string
          school_id: string
          successful_rows?: number | null
          total_rows?: number | null
          upload_type?: string | null
          uploaded_by: string
        }
        Update: {
          created_at?: string | null
          error_log?: Json | null
          failed_rows?: number | null
          file_name?: string | null
          id?: string
          school_id?: string
          successful_rows?: number | null
          total_rows?: number | null
          upload_type?: string | null
          uploaded_by?: string
        }
        Relationships: []
      }
      capability_history: {
        Row: {
          assessment_count: number
          capability_profile: Json
          computed_at: string
          created_at: string
          id: string
          student_id: string
        }
        Insert: {
          assessment_count?: number
          capability_profile: Json
          computed_at?: string
          created_at?: string
          id?: string
          student_id: string
        }
        Update: {
          assessment_count?: number
          capability_profile?: Json
          computed_at?: string
          created_at?: string
          id?: string
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "capability_history_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      career_intelligence: {
        Row: {
          ai_forecast: Json | null
          category: string
          cbc_mapping: Json | null
          created_at: string | null
          description: string | null
          id: string
          kenyan_market: Json | null
          last_updated: string
          name: string
          real_stories: Json | null
          updated_at: string | null
          verification_status: string
        }
        Insert: {
          ai_forecast?: Json | null
          category: string
          cbc_mapping?: Json | null
          created_at?: string | null
          description?: string | null
          id: string
          kenyan_market?: Json | null
          last_updated?: string
          name: string
          real_stories?: Json | null
          updated_at?: string | null
          verification_status?: string
        }
        Update: {
          ai_forecast?: Json | null
          category?: string
          cbc_mapping?: Json | null
          created_at?: string | null
          description?: string | null
          id?: string
          kenyan_market?: Json | null
          last_updated?: string
          name?: string
          real_stories?: Json | null
          updated_at?: string | null
          verification_status?: string
        }
        Relationships: []
      }
      career_market_cache: {
        Row: {
          cached_at: string | null
          career_id: string
          data: Json
        }
        Insert: {
          cached_at?: string | null
          career_id: string
          data: Json
        }
        Update: {
          cached_at?: string | null
          career_id?: string
          data?: Json
        }
        Relationships: []
      }
      career_match_reports: {
        Row: {
          alternatives: Json | null
          career_id: string | null
          created_at: string
          id: string
          match_dimensions: Json | null
          match_score: number | null
          pathway: Json | null
          risks: Json | null
          student_id: string
          updated_at: string | null
        }
        Insert: {
          alternatives?: Json | null
          career_id?: string | null
          created_at?: string
          id?: string
          match_dimensions?: Json | null
          match_score?: number | null
          pathway?: Json | null
          risks?: Json | null
          student_id: string
          updated_at?: string | null
        }
        Update: {
          alternatives?: Json | null
          career_id?: string | null
          created_at?: string
          id?: string
          match_dimensions?: Json | null
          match_score?: number | null
          pathway?: Json | null
          risks?: Json | null
          student_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "career_match_reports_career_id_fkey"
            columns: ["career_id"]
            isOneToOne: false
            referencedRelation: "career_intelligence"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "career_match_reports_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      career_review_queue: {
        Row: {
          career_name: string
          created_at: string
          id: string
          reviewer_notes: string | null
          status: string
          submitted_by: string | null
          updated_at: string | null
        }
        Insert: {
          career_name: string
          created_at?: string
          id?: string
          reviewer_notes?: string | null
          status?: string
          submitted_by?: string | null
          updated_at?: string | null
        }
        Update: {
          career_name?: string
          created_at?: string
          id?: string
          reviewer_notes?: string | null
          status?: string
          submitted_by?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      careers: {
        Row: {
          ai_impact: Json | null
          alternative_career_slugs: string[] | null
          capability_cluster: string[] | null
          category: string
          complementary_career_slugs: string[] | null
          cost_to_qualify: Json | null
          created_at: string | null
          description: string
          difficulty: string | null
          disclaimer: string | null
          doors: Json | null
          early_start: Json | null
          future_skills: Json
          id: string
          kcse_minimum: Json | null
          kenya_demand: string | null
          kenya_examples: Json | null
          kenya_market_outlook: string
          pathway: string | null
          prestige_level: number | null
          required_capabilities: Json | null
          required_subjects: Json
          risk_level: string | null
          salary_range_kes: Json | null
          saturation_note: string | null
          search_count: number
          skill_timeline: Json
          slug: string
          social_reality: Json | null
          source: string
          subject_importance: Json | null
          time_to_income_years: number | null
          title: string
          university_courses: Json | null
          updated_at: string | null
        }
        Insert: {
          ai_impact?: Json | null
          alternative_career_slugs?: string[] | null
          capability_cluster?: string[] | null
          category: string
          complementary_career_slugs?: string[] | null
          cost_to_qualify?: Json | null
          created_at?: string | null
          description: string
          difficulty?: string | null
          disclaimer?: string | null
          doors?: Json | null
          early_start?: Json | null
          future_skills: Json
          id?: string
          kcse_minimum?: Json | null
          kenya_demand?: string | null
          kenya_examples?: Json | null
          kenya_market_outlook: string
          pathway?: string | null
          prestige_level?: number | null
          required_capabilities?: Json | null
          required_subjects: Json
          risk_level?: string | null
          salary_range_kes?: Json | null
          saturation_note?: string | null
          search_count?: number
          skill_timeline: Json
          slug: string
          social_reality?: Json | null
          source?: string
          subject_importance?: Json | null
          time_to_income_years?: number | null
          title: string
          university_courses?: Json | null
          updated_at?: string | null
        }
        Update: {
          ai_impact?: Json | null
          alternative_career_slugs?: string[] | null
          capability_cluster?: string[] | null
          category?: string
          complementary_career_slugs?: string[] | null
          cost_to_qualify?: Json | null
          created_at?: string | null
          description?: string
          difficulty?: string | null
          disclaimer?: string | null
          doors?: Json | null
          early_start?: Json | null
          future_skills?: Json
          id?: string
          kcse_minimum?: Json | null
          kenya_demand?: string | null
          kenya_examples?: Json | null
          kenya_market_outlook?: string
          pathway?: string | null
          prestige_level?: number | null
          required_capabilities?: Json | null
          required_subjects?: Json
          risk_level?: string | null
          salary_range_kes?: Json | null
          saturation_note?: string | null
          search_count?: number
          skill_timeline?: Json
          slug?: string
          social_reality?: Json | null
          source?: string
          subject_importance?: Json | null
          time_to_income_years?: number | null
          title?: string
          university_courses?: Json | null
          updated_at?: string | null
        }
        Relationships: []
      }
      chat_logs: {
        Row: {
          created_at: string | null
          difficulty: number | null
          id: string
          message: string
          metadata: Json | null
          response: string
          student_id: string | null
          subject: string | null
          tokens_used: number | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          difficulty?: number | null
          id?: string
          message: string
          metadata?: Json | null
          response: string
          student_id?: string | null
          subject?: string | null
          tokens_used?: number | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          difficulty?: number | null
          id?: string
          message?: string
          metadata?: Json | null
          response?: string
          student_id?: string | null
          subject?: string | null
          tokens_used?: number | null
          user_id?: string
        }
        Relationships: []
      }
      chat_messages: {
        Row: {
          content: string
          created_at: string | null
          id: string
          role: string | null
          session_id: string | null
        }
        Insert: {
          content: string
          created_at?: string | null
          id?: string
          role?: string | null
          session_id?: string | null
        }
        Update: {
          content?: string
          created_at?: string | null
          id?: string
          role?: string | null
          session_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "chat_messages_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "chat_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_sessions: {
        Row: {
          created_at: string | null
          grade: string | null
          id: string
          subject: string | null
          title: string
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          grade?: string | null
          id?: string
          subject?: string | null
          title?: string
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          grade?: string | null
          id?: string
          subject?: string | null
          title?: string
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      class_assessments: {
        Row: {
          assessment_type: string | null
          class_id: string | null
          created_at: string | null
          curriculum_type: string | null
          external_id: string | null
          grade_id: string | null
          grade_scale_id: string | null
          grading_type: string
          id: string
          integration_connection_id: string | null
          is_published: boolean
          max_score: number | null
          subjects: string[]
          teacher_id: string
          term: string
          title: string
          updated_at: string | null
          weight_percent: number
          year: number
        }
        Insert: {
          assessment_type?: string | null
          class_id?: string | null
          created_at?: string | null
          curriculum_type?: string | null
          external_id?: string | null
          grade_id?: string | null
          grade_scale_id?: string | null
          grading_type?: string
          id?: string
          integration_connection_id?: string | null
          is_published?: boolean
          max_score?: number | null
          subjects?: string[]
          teacher_id: string
          term: string
          title: string
          updated_at?: string | null
          weight_percent?: number
          year: number
        }
        Update: {
          assessment_type?: string | null
          class_id?: string | null
          created_at?: string | null
          curriculum_type?: string | null
          external_id?: string | null
          grade_id?: string | null
          grade_scale_id?: string | null
          grading_type?: string
          id?: string
          integration_connection_id?: string | null
          is_published?: boolean
          max_score?: number | null
          subjects?: string[]
          teacher_id?: string
          term?: string
          title?: string
          updated_at?: string | null
          weight_percent?: number
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "class_assessments_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "teacher_classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "class_assessments_grade_id_fkey"
            columns: ["grade_id"]
            isOneToOne: false
            referencedRelation: "grades"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "class_assessments_grade_scale_id_fkey"
            columns: ["grade_scale_id"]
            isOneToOne: false
            referencedRelation: "teacher_grade_scales"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "class_assessments_integration_connection_id_fkey"
            columns: ["integration_connection_id"]
            isOneToOne: false
            referencedRelation: "integration_connections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "class_assessments_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "teachers"
            referencedColumns: ["id"]
          },
        ]
      }
      class_differentiation_plans: {
        Row: {
          class_id: string
          created_at: string
          id: string
          is_published: boolean
          plan_data: Json
          published_at: string | null
          subject: string
          teacher_id: string
          term: number
          updated_at: string
          year: number
        }
        Insert: {
          class_id: string
          created_at?: string
          id?: string
          is_published?: boolean
          plan_data: Json
          published_at?: string | null
          subject: string
          teacher_id: string
          term: number
          updated_at?: string
          year: number
        }
        Update: {
          class_id?: string
          created_at?: string
          id?: string
          is_published?: boolean
          plan_data?: Json
          published_at?: string | null
          subject?: string
          teacher_id?: string
          term?: number
          updated_at?: string
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "class_differentiation_plans_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "teacher_classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "class_differentiation_plans_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "teachers"
            referencedColumns: ["id"]
          },
        ]
      }
      class_invites: {
        Row: {
          class_id: string | null
          created_at: string | null
          expires_at: string | null
          id: string
          invite_code: string
          teacher_id: string | null
          updated_at: string | null
          used_count: number | null
        }
        Insert: {
          class_id?: string | null
          created_at?: string | null
          expires_at?: string | null
          id?: string
          invite_code?: string
          teacher_id?: string | null
          updated_at?: string | null
          used_count?: number | null
        }
        Update: {
          class_id?: string | null
          created_at?: string | null
          expires_at?: string | null
          id?: string
          invite_code?: string
          teacher_id?: string | null
          updated_at?: string | null
          used_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "class_invites_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "teacher_classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "class_invites_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "teachers"
            referencedColumns: ["id"]
          },
        ]
      }
      class_students: {
        Row: {
          class_id: string
          created_at: string | null
          id: string
          joined_at: string
          parent_id: string | null
          student_id: string
          updated_at: string | null
        }
        Insert: {
          class_id: string
          created_at?: string | null
          id?: string
          joined_at?: string
          parent_id?: string | null
          student_id: string
          updated_at?: string | null
        }
        Update: {
          class_id?: string
          created_at?: string | null
          id?: string
          joined_at?: string
          parent_id?: string | null
          student_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "class_students_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "teacher_classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "class_students_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      class_subjects: {
        Row: {
          class_id: string
          created_at: string
          id: string
          school_id: string
          subject_id: string
          teacher_id: string
          updated_at: string
        }
        Insert: {
          class_id: string
          created_at?: string
          id?: string
          school_id: string
          subject_id: string
          teacher_id: string
          updated_at?: string
        }
        Update: {
          class_id?: string
          created_at?: string
          id?: string
          school_id?: string
          subject_id?: string
          teacher_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "class_subjects_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "class_subjects_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "class_subjects_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "class_subjects_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "school_users"
            referencedColumns: ["id"]
          },
        ]
      }
      class_teachers: {
        Row: {
          class_id: string
          created_at: string | null
          id: string
          role: string | null
          subject: string | null
          teacher_id: string
          updated_at: string | null
        }
        Insert: {
          class_id: string
          created_at?: string | null
          id?: string
          role?: string | null
          subject?: string | null
          teacher_id: string
          updated_at?: string | null
        }
        Update: {
          class_id?: string
          created_at?: string | null
          id?: string
          role?: string | null
          subject?: string | null
          teacher_id?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      classes: {
        Row: {
          academic_year: number | null
          academic_year_id: string | null
          capacity: number | null
          class_name: string | null
          class_teacher_id: string | null
          created_at: string | null
          display_name: string | null
          grade: number | null
          grade_id: string | null
          id: string
          school_id: string | null
          stream: string | null
          stream_id: string | null
          updated_at: string | null
        }
        Insert: {
          academic_year?: number | null
          academic_year_id?: string | null
          capacity?: number | null
          class_name?: string | null
          class_teacher_id?: string | null
          created_at?: string | null
          display_name?: string | null
          grade?: number | null
          grade_id?: string | null
          id?: string
          school_id?: string | null
          stream?: string | null
          stream_id?: string | null
          updated_at?: string | null
        }
        Update: {
          academic_year?: number | null
          academic_year_id?: string | null
          capacity?: number | null
          class_name?: string | null
          class_teacher_id?: string | null
          created_at?: string | null
          display_name?: string | null
          grade?: number | null
          grade_id?: string | null
          id?: string
          school_id?: string | null
          stream?: string | null
          stream_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "classes_academic_year_id_fkey"
            columns: ["academic_year_id"]
            isOneToOne: false
            referencedRelation: "academic_years"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "classes_class_teacher_id_fkey"
            columns: ["class_teacher_id"]
            isOneToOne: false
            referencedRelation: "school_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "classes_grade_id_fkey"
            columns: ["grade_id"]
            isOneToOne: false
            referencedRelation: "grades"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "classes_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "classes_stream_id_fkey"
            columns: ["stream_id"]
            isOneToOne: false
            referencedRelation: "streams"
            referencedColumns: ["id"]
          },
        ]
      }
      clinic_reports: {
        Row: {
          assessments_count: number | null
          careers_analysis: Json | null
          created_at: string | null
          data_completeness: string | null
          generated_at: string
          grade: number
          id: string
          newest_assessment_date: string | null
          next_review_date: string
          oldest_assessment_date: string | null
          pathway_recommendation: Json | null
          pdf_generated: boolean | null
          pdf_generated_at: string | null
          pdf_url: string | null
          report_id: string
          student_id: string
          student_summary: Json
          subjects_summary: Json
          term: number
          updated_at: string | null
          version: string
          warnings: string[] | null
          year: number
        }
        Insert: {
          assessments_count?: number | null
          careers_analysis?: Json | null
          created_at?: string | null
          data_completeness?: string | null
          generated_at: string
          grade: number
          id?: string
          newest_assessment_date?: string | null
          next_review_date: string
          oldest_assessment_date?: string | null
          pathway_recommendation?: Json | null
          pdf_generated?: boolean | null
          pdf_generated_at?: string | null
          pdf_url?: string | null
          report_id: string
          student_id: string
          student_summary: Json
          subjects_summary: Json
          term: number
          updated_at?: string | null
          version?: string
          warnings?: string[] | null
          year: number
        }
        Update: {
          assessments_count?: number | null
          careers_analysis?: Json | null
          created_at?: string | null
          data_completeness?: string | null
          generated_at?: string
          grade?: number
          id?: string
          newest_assessment_date?: string | null
          next_review_date?: string
          oldest_assessment_date?: string | null
          pathway_recommendation?: Json | null
          pdf_generated?: boolean | null
          pdf_generated_at?: string | null
          pdf_url?: string | null
          report_id?: string
          student_id?: string
          student_summary?: Json
          subjects_summary?: Json
          term?: number
          updated_at?: string | null
          version?: string
          warnings?: string[] | null
          year?: number
        }
        Relationships: []
      }
      compass_messages: {
        Row: {
          content: string
          created_at: string
          id: string
          metadata: Json | null
          role: string
          session_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          metadata?: Json | null
          role: string
          session_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          metadata?: Json | null
          role?: string
          session_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "compass_messages_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "compass_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      compass_outcomes: {
        Row: {
          achieved_at: string | null
          concept: string
          created_at: string
          id: string
          last_attempted: string | null
          mastery_evidence: Json
          mastery_statement: string
          milestones: Json
          sessions_spent: number
          set_by: string
          status: string
          student_id: string
          subject: string
          substrand: string | null
          teacher_note: string | null
          updated_at: string
        }
        Insert: {
          achieved_at?: string | null
          concept: string
          created_at?: string
          id?: string
          last_attempted?: string | null
          mastery_evidence?: Json
          mastery_statement: string
          milestones?: Json
          sessions_spent?: number
          set_by?: string
          status?: string
          student_id: string
          subject: string
          substrand?: string | null
          teacher_note?: string | null
          updated_at?: string
        }
        Update: {
          achieved_at?: string | null
          concept?: string
          created_at?: string
          id?: string
          last_attempted?: string | null
          mastery_evidence?: Json
          mastery_statement?: string
          milestones?: Json
          sessions_spent?: number
          set_by?: string
          status?: string
          student_id?: string
          subject?: string
          substrand?: string | null
          teacher_note?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "compass_outcomes_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      compass_progress: {
        Row: {
          average_accuracy: number | null
          baseline_score: number | null
          config_id: string | null
          created_at: string | null
          current_score: number | null
          id: string
          improvement_rate: number | null
          last_session_at: string | null
          on_track: boolean | null
          predicted_completion_date: string | null
          student_id: string
          subject: string
          subject_display: string
          target_score: number | null
          total_minutes: number | null
          total_sessions: number | null
          updated_at: string | null
          velocity_trend: string | null
          weekly_snapshots: Json | null
        }
        Insert: {
          average_accuracy?: number | null
          baseline_score?: number | null
          config_id?: string | null
          created_at?: string | null
          current_score?: number | null
          id?: string
          improvement_rate?: number | null
          last_session_at?: string | null
          on_track?: boolean | null
          predicted_completion_date?: string | null
          student_id: string
          subject: string
          subject_display: string
          target_score?: number | null
          total_minutes?: number | null
          total_sessions?: number | null
          updated_at?: string | null
          velocity_trend?: string | null
          weekly_snapshots?: Json | null
        }
        Update: {
          average_accuracy?: number | null
          baseline_score?: number | null
          config_id?: string | null
          created_at?: string | null
          current_score?: number | null
          id?: string
          improvement_rate?: number | null
          last_session_at?: string | null
          on_track?: boolean | null
          predicted_completion_date?: string | null
          student_id?: string
          subject?: string
          subject_display?: string
          target_score?: number | null
          total_minutes?: number | null
          total_sessions?: number | null
          updated_at?: string | null
          velocity_trend?: string | null
          weekly_snapshots?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "compass_progress_config_id_fkey"
            columns: ["config_id"]
            isOneToOne: false
            referencedRelation: "learning_compass_configs"
            referencedColumns: ["id"]
          },
        ]
      }
      compass_sessions: {
        Row: {
          completed_at: string | null
          created_at: string
          duration_seconds: number | null
          ending_level: number | null
          exchange_count: number
          id: string
          last_subject: string | null
          learner_id: string
          message_count: number | null
          mode: string | null
          one_line_summary: string | null
          session_state: Json
          starting_level: number | null
          status: string | null
          subject: string | null
          updated_at: string
          xp_earned: number | null
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          duration_seconds?: number | null
          ending_level?: number | null
          exchange_count?: number
          id?: string
          last_subject?: string | null
          learner_id: string
          message_count?: number | null
          mode?: string | null
          one_line_summary?: string | null
          session_state?: Json
          starting_level?: number | null
          status?: string | null
          subject?: string | null
          updated_at?: string
          xp_earned?: number | null
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          duration_seconds?: number | null
          ending_level?: number | null
          exchange_count?: number
          id?: string
          last_subject?: string | null
          learner_id?: string
          message_count?: number | null
          mode?: string | null
          one_line_summary?: string | null
          session_state?: Json
          starting_level?: number | null
          status?: string | null
          subject?: string | null
          updated_at?: string
          xp_earned?: number | null
        }
        Relationships: []
      }
      curriculum_configs: {
        Row: {
          created_at: string | null
          full_name: string
          grade_labels: Json
          grading_system: string
          id: string
          is_active: boolean | null
          name: string
          phases: Json
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          full_name: string
          grade_labels: Json
          grading_system: string
          id: string
          is_active?: boolean | null
          name: string
          phases: Json
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          full_name?: string
          grade_labels?: Json
          grading_system?: string
          id?: string
          is_active?: boolean | null
          name?: string
          phases?: Json
          updated_at?: string | null
        }
        Relationships: []
      }
      developer_api_keys: {
        Row: {
          created_at: string
          developer_id: string
          environment: string
          expires_at: string | null
          id: string
          key_hash: string
          key_prefix: string
          last_used_at: string | null
          name: string
          project_id: string | null
          rate_limit_rpm: number
          scopes: string[]
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          developer_id: string
          environment?: string
          expires_at?: string | null
          id?: string
          key_hash: string
          key_prefix: string
          last_used_at?: string | null
          name: string
          project_id?: string | null
          rate_limit_rpm?: number
          scopes?: string[]
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          developer_id?: string
          environment?: string
          expires_at?: string | null
          id?: string
          key_hash?: string
          key_prefix?: string
          last_used_at?: string | null
          name?: string
          project_id?: string | null
          rate_limit_rpm?: number
          scopes?: string[]
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "developer_api_keys_developer_id_fkey"
            columns: ["developer_id"]
            isOneToOne: false
            referencedRelation: "developer_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "developer_api_keys_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "developer_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      developer_profiles: {
        Row: {
          avatar_url: string | null
          bio: string | null
          created_at: string
          email: string
          github_username: string | null
          id: string
          name: string
          onboarded_at: string | null
          organization: string | null
          tier: string
          updated_at: string
          website: string | null
        }
        Insert: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          email: string
          github_username?: string | null
          id: string
          name: string
          onboarded_at?: string | null
          organization?: string | null
          tier?: string
          updated_at?: string
          website?: string | null
        }
        Update: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          email?: string
          github_username?: string | null
          id?: string
          name?: string
          onboarded_at?: string | null
          organization?: string | null
          tier?: string
          updated_at?: string
          website?: string | null
        }
        Relationships: []
      }
      developer_projects: {
        Row: {
          created_at: string
          description: string | null
          developer_id: string
          environment: string
          id: string
          name: string
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          developer_id: string
          environment?: string
          id?: string
          name: string
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          developer_id?: string
          environment?: string
          id?: string
          name?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "developer_projects_developer_id_fkey"
            columns: ["developer_id"]
            isOneToOne: false
            referencedRelation: "developer_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      developer_request_logs: {
        Row: {
          api_key_id: string | null
          created_at: string
          developer_id: string
          id: string
          ip_address: string | null
          latency_ms: number | null
          method: string
          path: string
          status_code: number
          tokens_used: number | null
          user_agent: string | null
        }
        Insert: {
          api_key_id?: string | null
          created_at?: string
          developer_id: string
          id?: string
          ip_address?: string | null
          latency_ms?: number | null
          method: string
          path: string
          status_code: number
          tokens_used?: number | null
          user_agent?: string | null
        }
        Update: {
          api_key_id?: string | null
          created_at?: string
          developer_id?: string
          id?: string
          ip_address?: string | null
          latency_ms?: number | null
          method?: string
          path?: string
          status_code?: number
          tokens_used?: number | null
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "developer_request_logs_api_key_id_fkey"
            columns: ["api_key_id"]
            isOneToOne: false
            referencedRelation: "developer_api_keys"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "developer_request_logs_developer_id_fkey"
            columns: ["developer_id"]
            isOneToOne: false
            referencedRelation: "developer_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      developer_usage_daily: {
        Row: {
          api_key_id: string | null
          created_at: string
          date: string
          developer_id: string
          errors: number
          id: string
          latency_p50: number | null
          latency_p99: number | null
          requests: number
          tokens_used: number
          updated_at: string
        }
        Insert: {
          api_key_id?: string | null
          created_at?: string
          date?: string
          developer_id: string
          errors?: number
          id?: string
          latency_p50?: number | null
          latency_p99?: number | null
          requests?: number
          tokens_used?: number
          updated_at?: string
        }
        Update: {
          api_key_id?: string | null
          created_at?: string
          date?: string
          developer_id?: string
          errors?: number
          id?: string
          latency_p50?: number | null
          latency_p99?: number | null
          requests?: number
          tokens_used?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "developer_usage_daily_api_key_id_fkey"
            columns: ["api_key_id"]
            isOneToOne: false
            referencedRelation: "developer_api_keys"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "developer_usage_daily_developer_id_fkey"
            columns: ["developer_id"]
            isOneToOne: false
            referencedRelation: "developer_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      developer_webhook_deliveries: {
        Row: {
          attempt: number
          created_at: string
          developer_id: string
          event_type: string
          id: string
          latency_ms: number | null
          next_retry_at: string | null
          payload: Json
          response_body: string | null
          response_status: number | null
          success: boolean
          webhook_id: string
        }
        Insert: {
          attempt?: number
          created_at?: string
          developer_id: string
          event_type: string
          id?: string
          latency_ms?: number | null
          next_retry_at?: string | null
          payload?: Json
          response_body?: string | null
          response_status?: number | null
          success?: boolean
          webhook_id: string
        }
        Update: {
          attempt?: number
          created_at?: string
          developer_id?: string
          event_type?: string
          id?: string
          latency_ms?: number | null
          next_retry_at?: string | null
          payload?: Json
          response_body?: string | null
          response_status?: number | null
          success?: boolean
          webhook_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "developer_webhook_deliveries_webhook_id_fkey"
            columns: ["webhook_id"]
            isOneToOne: false
            referencedRelation: "developer_webhooks"
            referencedColumns: ["id"]
          },
        ]
      }
      developer_webhooks: {
        Row: {
          created_at: string
          developer_id: string
          events: string[]
          failure_count: number
          id: string
          last_ping_at: string | null
          name: string
          project_id: string | null
          secret_hash: string
          secret_prefix: string | null
          secret_raw: string | null
          status: string
          updated_at: string
          url: string
        }
        Insert: {
          created_at?: string
          developer_id: string
          events?: string[]
          failure_count?: number
          id?: string
          last_ping_at?: string | null
          name: string
          project_id?: string | null
          secret_hash: string
          secret_prefix?: string | null
          secret_raw?: string | null
          status?: string
          updated_at?: string
          url: string
        }
        Update: {
          created_at?: string
          developer_id?: string
          events?: string[]
          failure_count?: number
          id?: string
          last_ping_at?: string | null
          name?: string
          project_id?: string | null
          secret_hash?: string
          secret_prefix?: string | null
          secret_raw?: string | null
          status?: string
          updated_at?: string
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "developer_webhooks_developer_id_fkey"
            columns: ["developer_id"]
            isOneToOne: false
            referencedRelation: "developer_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "developer_webhooks_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "developer_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      document_downloads: {
        Row: {
          document_type: string
          downloaded_at: string
          id: string
          last_week_downloaded: number | null
          lesson_count_at_download: number | null
          scheme_id: string
          teacher_id: string
          total_weeks: number | null
        }
        Insert: {
          document_type: string
          downloaded_at?: string
          id?: string
          last_week_downloaded?: number | null
          lesson_count_at_download?: number | null
          scheme_id: string
          teacher_id: string
          total_weeks?: number | null
        }
        Update: {
          document_type?: string
          downloaded_at?: string
          id?: string
          last_week_downloaded?: number | null
          lesson_count_at_download?: number | null
          scheme_id?: string
          teacher_id?: string
          total_weeks?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "document_downloads_scheme_id_fkey"
            columns: ["scheme_id"]
            isOneToOne: false
            referencedRelation: "schemes_of_work"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_downloads_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "teachers"
            referencedColumns: ["id"]
          },
        ]
      }
      dynamic_careers: {
        Row: {
          category: string | null
          created_at: string
          data: Json | null
          description: string | null
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          category?: string | null
          created_at?: string
          data?: Json | null
          description?: string | null
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          category?: string | null
          created_at?: string
          data?: Json | null
          description?: string | null
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      early_access_leads: {
        Row: {
          activated_at: string | null
          created_at: string
          email: string | null
          id: string
          name: string | null
          notes: string | null
          phone: string | null
          plan: string
          status: string
          student_grade: number | null
          updated_at: string | null
        }
        Insert: {
          activated_at?: string | null
          created_at?: string
          email?: string | null
          id?: string
          name?: string | null
          notes?: string | null
          phone?: string | null
          plan: string
          status?: string
          student_grade?: number | null
          updated_at?: string | null
        }
        Update: {
          activated_at?: string | null
          created_at?: string
          email?: string | null
          id?: string
          name?: string | null
          notes?: string | null
          phone?: string | null
          plan?: string
          status?: string
          student_grade?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      eils_events: {
        Row: {
          created_at: string
          event_type: string
          id: string
          payload: Json
          processed: boolean
          processed_at: string | null
          source: string
          student_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          event_type: string
          id?: string
          payload?: Json
          processed?: boolean
          processed_at?: string | null
          source: string
          student_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          event_type?: string
          id?: string
          payload?: Json
          processed?: boolean
          processed_at?: string | null
          source?: string
          student_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "eils_events_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "learners"
            referencedColumns: ["id"]
          },
        ]
      }
      eils_interventions: {
        Row: {
          consecutive_weeks_before: number | null
          created_at: string
          id: string
          intervention_ref: string | null
          intervention_type: string
          outcome: string | null
          outcome_evidence: Json | null
          resolved_at: string | null
          risk_flag_type: string
          started_at: string
          student_id: string
          subject: string | null
          substrand: string | null
          teacher_id: string | null
          updated_at: string
          was_effective: boolean | null
        }
        Insert: {
          consecutive_weeks_before?: number | null
          created_at?: string
          id?: string
          intervention_ref?: string | null
          intervention_type: string
          outcome?: string | null
          outcome_evidence?: Json | null
          resolved_at?: string | null
          risk_flag_type: string
          started_at?: string
          student_id: string
          subject?: string | null
          substrand?: string | null
          teacher_id?: string | null
          updated_at?: string
          was_effective?: boolean | null
        }
        Update: {
          consecutive_weeks_before?: number | null
          created_at?: string
          id?: string
          intervention_ref?: string | null
          intervention_type?: string
          outcome?: string | null
          outcome_evidence?: Json | null
          resolved_at?: string | null
          risk_flag_type?: string
          started_at?: string
          student_id?: string
          subject?: string | null
          substrand?: string | null
          teacher_id?: string | null
          updated_at?: string
          was_effective?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "eils_interventions_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "learners"
            referencedColumns: ["id"]
          },
        ]
      }
      eils_milestones: {
        Row: {
          achieved_at: string
          celebrated: boolean
          created_at: string
          description: string
          evidence: Json
          id: string
          milestone_type: string
          notified_parent: boolean
          notified_teacher: boolean
          student_id: string
          title: string
          updated_at: string
        }
        Insert: {
          achieved_at: string
          celebrated?: boolean
          created_at?: string
          description: string
          evidence?: Json
          id?: string
          milestone_type: string
          notified_parent?: boolean
          notified_teacher?: boolean
          student_id: string
          title: string
          updated_at?: string
        }
        Update: {
          achieved_at?: string
          celebrated?: boolean
          created_at?: string
          description?: string
          evidence?: Json
          id?: string
          milestone_type?: string
          notified_parent?: boolean
          notified_teacher?: boolean
          student_id?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "eils_milestones_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "learners"
            referencedColumns: ["id"]
          },
        ]
      }
      eils_reasoning_log: {
        Row: {
          career_evidence: Json | null
          conclusion: string
          confidence: number
          created_at: string
          evidence: Json
          id: string
          kg_evidence: Json | null
          learner_history_evidence: Json | null
          question: string
          reasoning_type: string
          recommendation_id: string | null
          student_id: string
          updated_at: string
        }
        Insert: {
          career_evidence?: Json | null
          conclusion: string
          confidence?: number
          created_at?: string
          evidence?: Json
          id?: string
          kg_evidence?: Json | null
          learner_history_evidence?: Json | null
          question: string
          reasoning_type: string
          recommendation_id?: string | null
          student_id: string
          updated_at?: string
        }
        Update: {
          career_evidence?: Json | null
          conclusion?: string
          confidence?: number
          created_at?: string
          evidence?: Json
          id?: string
          kg_evidence?: Json | null
          learner_history_evidence?: Json | null
          question?: string
          reasoning_type?: string
          recommendation_id?: string | null
          student_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "eils_reasoning_log_recommendation_id_fkey"
            columns: ["recommendation_id"]
            isOneToOne: false
            referencedRelation: "eils_recommendations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "eils_reasoning_log_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "learners"
            referencedColumns: ["id"]
          },
        ]
      }
      eils_recommendations: {
        Row: {
          action_type: string
          actioned_at: string | null
          confidence: number
          created_at: string
          evidence: Json
          expected_impact: string
          expires_at: string | null
          id: string
          outcome: string | null
          outcome_note: string | null
          priority: number
          reasoning: string
          source_system: string
          status: string
          student_id: string
          subject: string | null
          substrand: string | null
          updated_at: string
        }
        Insert: {
          action_type: string
          actioned_at?: string | null
          confidence?: number
          created_at?: string
          evidence?: Json
          expected_impact: string
          expires_at?: string | null
          id?: string
          outcome?: string | null
          outcome_note?: string | null
          priority?: number
          reasoning: string
          source_system: string
          status?: string
          student_id: string
          subject?: string | null
          substrand?: string | null
          updated_at?: string
        }
        Update: {
          action_type?: string
          actioned_at?: string | null
          confidence?: number
          created_at?: string
          evidence?: Json
          expected_impact?: string
          expires_at?: string | null
          id?: string
          outcome?: string | null
          outcome_note?: string | null
          priority?: number
          reasoning?: string
          source_system?: string
          status?: string
          student_id?: string
          subject?: string | null
          substrand?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "eils_recommendations_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "learners"
            referencedColumns: ["id"]
          },
        ]
      }
      eir_career_development: {
        Row: {
          career_changed: boolean
          career_confidence: number | null
          career_readiness_score: number | null
          competency_growth_rate: number | null
          confidence_score: number | null
          created_at: string
          evidence: Json
          id: string
          interest_stability: number | null
          pathway: string | null
          pathway_changed: boolean
          previous_career_slug: string | null
          readiness_trend: string | null
          snapshot_at: string
          student_id: string
          top_career_slug: string | null
          updated_at: string
        }
        Insert: {
          career_changed?: boolean
          career_confidence?: number | null
          career_readiness_score?: number | null
          competency_growth_rate?: number | null
          confidence_score?: number | null
          created_at?: string
          evidence?: Json
          id?: string
          interest_stability?: number | null
          pathway?: string | null
          pathway_changed?: boolean
          previous_career_slug?: string | null
          readiness_trend?: string | null
          snapshot_at: string
          student_id: string
          top_career_slug?: string | null
          updated_at?: string
        }
        Update: {
          career_changed?: boolean
          career_confidence?: number | null
          career_readiness_score?: number | null
          competency_growth_rate?: number | null
          confidence_score?: number | null
          created_at?: string
          evidence?: Json
          id?: string
          interest_stability?: number | null
          pathway?: string | null
          pathway_changed?: boolean
          previous_career_slug?: string | null
          readiness_trend?: string | null
          snapshot_at?: string
          student_id?: string
          top_career_slug?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "eir_career_development_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "learners"
            referencedColumns: ["id"]
          },
        ]
      }
      eir_findings: {
        Row: {
          action_recommendation: string | null
          applies_to_curricula: string[]
          applies_to_grades: number[]
          applies_to_subjects: string[]
          confidence: number | null
          created_at: string
          detail: string | null
          evidence_strength: string
          finding_data: Json
          hypothesis_id: string | null
          id: string
          last_verified_at: string
          pillar: string
          published_at: string
          sample_size: number | null
          summary: string
          title: string
          updated_at: string
        }
        Insert: {
          action_recommendation?: string | null
          applies_to_curricula?: string[]
          applies_to_grades?: number[]
          applies_to_subjects?: string[]
          confidence?: number | null
          created_at?: string
          detail?: string | null
          evidence_strength: string
          finding_data?: Json
          hypothesis_id?: string | null
          id?: string
          last_verified_at?: string
          pillar: string
          published_at?: string
          sample_size?: number | null
          summary: string
          title: string
          updated_at?: string
        }
        Update: {
          action_recommendation?: string | null
          applies_to_curricula?: string[]
          applies_to_grades?: number[]
          applies_to_subjects?: string[]
          confidence?: number | null
          created_at?: string
          detail?: string | null
          evidence_strength?: string
          finding_data?: Json
          hypothesis_id?: string | null
          id?: string
          last_verified_at?: string
          pillar?: string
          published_at?: string
          sample_size?: number | null
          summary?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "eir_findings_hypothesis_id_fkey"
            columns: ["hypothesis_id"]
            isOneToOne: false
            referencedRelation: "eir_hypotheses"
            referencedColumns: ["id"]
          },
        ]
      }
      eir_hypotheses: {
        Row: {
          counter_evidence: Json
          created_at: string
          description: string
          evidence_count: number
          id: string
          pillar: string
          proposed_at: string
          proposed_by: string
          rejected_at: string | null
          rejection_reason: string | null
          status: string
          supporting_evidence: Json
          tags: string[]
          testing_since: string | null
          title: string
          updated_at: string
          validated_at: string | null
        }
        Insert: {
          counter_evidence?: Json
          created_at?: string
          description: string
          evidence_count?: number
          id?: string
          pillar: string
          proposed_at?: string
          proposed_by?: string
          rejected_at?: string | null
          rejection_reason?: string | null
          status?: string
          supporting_evidence?: Json
          tags?: string[]
          testing_since?: string | null
          title: string
          updated_at?: string
          validated_at?: string | null
        }
        Update: {
          counter_evidence?: Json
          created_at?: string
          description?: string
          evidence_count?: number
          id?: string
          pillar?: string
          proposed_at?: string
          proposed_by?: string
          rejected_at?: string | null
          rejection_reason?: string | null
          status?: string
          supporting_evidence?: Json
          tags?: string[]
          testing_since?: string | null
          title?: string
          updated_at?: string
          validated_at?: string | null
        }
        Relationships: []
      }
      eir_intervention_effectiveness: {
        Row: {
          completed_at: string | null
          created_at: string
          days_to_resolution: number | null
          evidence: Json
          grade: number
          id: string
          intervention_type: string
          learner_profile_type: string | null
          learner_risk_level: string
          mastery_delta: number | null
          outcome: string | null
          post_mastery_level: number | null
          pre_mastery_level: number | null
          school_id: string | null
          started_at: string
          student_id: string
          subject: string
          substrand: string | null
          teacher_id: string | null
          updated_at: string
          was_effective: boolean | null
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          days_to_resolution?: number | null
          evidence?: Json
          grade: number
          id?: string
          intervention_type: string
          learner_profile_type?: string | null
          learner_risk_level: string
          mastery_delta?: number | null
          outcome?: string | null
          post_mastery_level?: number | null
          pre_mastery_level?: number | null
          school_id?: string | null
          started_at: string
          student_id: string
          subject: string
          substrand?: string | null
          teacher_id?: string | null
          updated_at?: string
          was_effective?: boolean | null
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          days_to_resolution?: number | null
          evidence?: Json
          grade?: number
          id?: string
          intervention_type?: string
          learner_profile_type?: string | null
          learner_risk_level?: string
          mastery_delta?: number | null
          outcome?: string | null
          post_mastery_level?: number | null
          pre_mastery_level?: number | null
          school_id?: string | null
          started_at?: string
          student_id?: string
          subject?: string
          substrand?: string | null
          teacher_id?: string | null
          updated_at?: string
          was_effective?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "eir_intervention_effectiveness_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "eir_intervention_effectiveness_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "learners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "eir_intervention_effectiveness_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "teachers"
            referencedColumns: ["id"]
          },
        ]
      }
      eir_kg_discoveries: {
        Row: {
          applied_at: string | null
          confidence: number | null
          created_at: string
          description: string
          discovery_type: string
          evidence: Json
          evidence_count: number
          id: string
          proposed_change: string | null
          rejected_at: string | null
          rejection_reason: string | null
          related_substrand: string | null
          status: string
          subject: string
          substrand: string
          supporting_student_count: number
          updated_at: string
          validated_at: string | null
        }
        Insert: {
          applied_at?: string | null
          confidence?: number | null
          created_at?: string
          description: string
          discovery_type: string
          evidence?: Json
          evidence_count?: number
          id?: string
          proposed_change?: string | null
          rejected_at?: string | null
          rejection_reason?: string | null
          related_substrand?: string | null
          status?: string
          subject: string
          substrand: string
          supporting_student_count?: number
          updated_at?: string
          validated_at?: string | null
        }
        Update: {
          applied_at?: string | null
          confidence?: number | null
          created_at?: string
          description?: string
          discovery_type?: string
          evidence?: Json
          evidence_count?: number
          id?: string
          proposed_change?: string | null
          rejected_at?: string | null
          rejection_reason?: string | null
          related_substrand?: string | null
          status?: string
          subject?: string
          substrand?: string
          supporting_student_count?: number
          updated_at?: string
          validated_at?: string | null
        }
        Relationships: []
      }
      eir_learning_trajectories: {
        Row: {
          assessment_count: number
          breakthrough_at: string | null
          compass_session_count: number
          created_at: string
          current_mastery_level: number | null
          days_since_last_assessment: number | null
          days_to_recover_after_intervention: number | null
          forgetting_curve_rate: number | null
          id: string
          mastery_velocity: number | null
          peak_mastery_level: number | null
          plateau_detected_at: string | null
          plateau_weeks: number | null
          retention_score: number | null
          snapshot_at: string
          student_id: string
          subject: string
          substrand: string
          trajectory_class: string | null
          updated_at: string
        }
        Insert: {
          assessment_count?: number
          breakthrough_at?: string | null
          compass_session_count?: number
          created_at?: string
          current_mastery_level?: number | null
          days_since_last_assessment?: number | null
          days_to_recover_after_intervention?: number | null
          forgetting_curve_rate?: number | null
          id?: string
          mastery_velocity?: number | null
          peak_mastery_level?: number | null
          plateau_detected_at?: string | null
          plateau_weeks?: number | null
          retention_score?: number | null
          snapshot_at: string
          student_id: string
          subject: string
          substrand: string
          trajectory_class?: string | null
          updated_at?: string
        }
        Update: {
          assessment_count?: number
          breakthrough_at?: string | null
          compass_session_count?: number
          created_at?: string
          current_mastery_level?: number | null
          days_since_last_assessment?: number | null
          days_to_recover_after_intervention?: number | null
          forgetting_curve_rate?: number | null
          id?: string
          mastery_velocity?: number | null
          peak_mastery_level?: number | null
          plateau_detected_at?: string | null
          plateau_weeks?: number | null
          retention_score?: number | null
          snapshot_at?: string
          student_id?: string
          subject?: string
          substrand?: string
          trajectory_class?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "eir_learning_trajectories_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "learners"
            referencedColumns: ["id"]
          },
        ]
      }
      eir_misconceptions: {
        Row: {
          correction_effectiveness: string | null
          correction_strategy: string | null
          created_at: string
          description: string
          evidence: Json
          first_seen_at: string
          frequency_count: number
          grade: number
          id: string
          last_seen_at: string
          misconception_type: string
          resolved_at: string | null
          root_cause: string | null
          school_id: string | null
          student_id: string
          subject: string
          substrand: string
          updated_at: string
        }
        Insert: {
          correction_effectiveness?: string | null
          correction_strategy?: string | null
          created_at?: string
          description: string
          evidence?: Json
          first_seen_at: string
          frequency_count?: number
          grade: number
          id?: string
          last_seen_at: string
          misconception_type: string
          resolved_at?: string | null
          root_cause?: string | null
          school_id?: string | null
          student_id: string
          subject: string
          substrand: string
          updated_at?: string
        }
        Update: {
          correction_effectiveness?: string | null
          correction_strategy?: string | null
          created_at?: string
          description?: string
          evidence?: Json
          first_seen_at?: string
          frequency_count?: number
          grade?: number
          id?: string
          last_seen_at?: string
          misconception_type?: string
          resolved_at?: string | null
          root_cause?: string | null
          school_id?: string | null
          student_id?: string
          subject?: string
          substrand?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "eir_misconceptions_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "eir_misconceptions_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "learners"
            referencedColumns: ["id"]
          },
        ]
      }
      eir_personalization_models: {
        Row: {
          created_at: string
          engagement_pattern: string | null
          evidence_count: number
          id: string
          last_updated_at: string
          model_confidence: number | null
          optimal_assessment_frequency_weeks: number | null
          optimal_challenge_level: number | null
          optimal_revision_interval_days: number | null
          optimal_session_mins: number | null
          optimal_time_preference: string | null
          preferred_explanation_style: string | null
          response_to_challenge: string | null
          response_to_feedback: string | null
          student_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          engagement_pattern?: string | null
          evidence_count?: number
          id?: string
          last_updated_at: string
          model_confidence?: number | null
          optimal_assessment_frequency_weeks?: number | null
          optimal_challenge_level?: number | null
          optimal_revision_interval_days?: number | null
          optimal_session_mins?: number | null
          optimal_time_preference?: string | null
          preferred_explanation_style?: string | null
          response_to_challenge?: string | null
          response_to_feedback?: string | null
          student_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          engagement_pattern?: string | null
          evidence_count?: number
          id?: string
          last_updated_at?: string
          model_confidence?: number | null
          optimal_assessment_frequency_weeks?: number | null
          optimal_challenge_level?: number | null
          optimal_revision_interval_days?: number | null
          optimal_session_mins?: number | null
          optimal_time_preference?: string | null
          preferred_explanation_style?: string | null
          response_to_challenge?: string | null
          response_to_feedback?: string | null
          student_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "eir_personalization_models_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: true
            referencedRelation: "learners"
            referencedColumns: ["id"]
          },
        ]
      }
      eir_recommendation_outcomes: {
        Row: {
          actioned_at: string | null
          alternative_actions: Json
          confidence: number | null
          created_at: string
          educational_theory: string | null
          evidence_summary: Json
          explanation: string
          feedback_recorded_at: string | null
          id: string
          improvement_delta: number | null
          learner_feedback: string | null
          outcome: string | null
          outcome_recorded_at: string | null
          parent_feedback: string | null
          post_mastery_level: number | null
          pre_mastery_level: number | null
          recommendation_id: string
          recommendation_type: string
          status: string
          student_id: string
          subject: string | null
          substrand: string | null
          teacher_feedback: string | null
          updated_at: string
        }
        Insert: {
          actioned_at?: string | null
          alternative_actions?: Json
          confidence?: number | null
          created_at?: string
          educational_theory?: string | null
          evidence_summary?: Json
          explanation: string
          feedback_recorded_at?: string | null
          id?: string
          improvement_delta?: number | null
          learner_feedback?: string | null
          outcome?: string | null
          outcome_recorded_at?: string | null
          parent_feedback?: string | null
          post_mastery_level?: number | null
          pre_mastery_level?: number | null
          recommendation_id: string
          recommendation_type: string
          status?: string
          student_id: string
          subject?: string | null
          substrand?: string | null
          teacher_feedback?: string | null
          updated_at?: string
        }
        Update: {
          actioned_at?: string | null
          alternative_actions?: Json
          confidence?: number | null
          created_at?: string
          educational_theory?: string | null
          evidence_summary?: Json
          explanation?: string
          feedback_recorded_at?: string | null
          id?: string
          improvement_delta?: number | null
          learner_feedback?: string | null
          outcome?: string | null
          outcome_recorded_at?: string | null
          parent_feedback?: string | null
          post_mastery_level?: number | null
          pre_mastery_level?: number | null
          recommendation_id?: string
          recommendation_type?: string
          status?: string
          student_id?: string
          subject?: string | null
          substrand?: string | null
          teacher_feedback?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "eir_recommendation_outcomes_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "learners"
            referencedColumns: ["id"]
          },
        ]
      }
      eir_risk_predictions: {
        Row: {
          actual_risk_level: string | null
          confidence: number | null
          created_at: string
          evaluate_at: string
          evaluated_at: string | null
          id: string
          model_version: string
          predicted_at: string
          predicted_risk_level: string
          prediction_features: Json
          prediction_horizon_days: number
          risk_type: string
          student_id: string
          updated_at: string
          was_accurate: boolean | null
        }
        Insert: {
          actual_risk_level?: string | null
          confidence?: number | null
          created_at?: string
          evaluate_at: string
          evaluated_at?: string | null
          id?: string
          model_version?: string
          predicted_at: string
          predicted_risk_level: string
          prediction_features?: Json
          prediction_horizon_days: number
          risk_type: string
          student_id: string
          updated_at?: string
          was_accurate?: boolean | null
        }
        Update: {
          actual_risk_level?: string | null
          confidence?: number | null
          created_at?: string
          evaluate_at?: string
          evaluated_at?: string | null
          id?: string
          model_version?: string
          predicted_at?: string
          predicted_risk_level?: string
          prediction_features?: Json
          prediction_horizon_days?: number
          risk_type?: string
          student_id?: string
          updated_at?: string
          was_accurate?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "eir_risk_predictions_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "learners"
            referencedColumns: ["id"]
          },
        ]
      }
      evidence_audit_log: {
        Row: {
          actor: string
          event_type: string
          evidence_id: string
          id: string
          metadata: Json
          new_state: string
          occurred_at: string
          previous_state: string | null
          reason: string | null
        }
        Insert: {
          actor: string
          event_type: string
          evidence_id: string
          id?: string
          metadata?: Json
          new_state: string
          occurred_at?: string
          previous_state?: string | null
          reason?: string | null
        }
        Update: {
          actor?: string
          event_type?: string
          evidence_id?: string
          id?: string
          metadata?: Json
          new_state?: string
          occurred_at?: string
          previous_state?: string | null
          reason?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "evidence_audit_log_evidence_id_fkey"
            columns: ["evidence_id"]
            isOneToOne: false
            referencedRelation: "learner_evidence"
            referencedColumns: ["id"]
          },
        ]
      }
      evidence_projection_events: {
        Row: {
          event_type: string
          evidence_id: string
          id: string
          learner_id: string
          metadata: Json
          occurred_at: string
          processed_at: string | null
        }
        Insert: {
          event_type: string
          evidence_id: string
          id?: string
          learner_id: string
          metadata?: Json
          occurred_at?: string
          processed_at?: string | null
        }
        Update: {
          event_type?: string
          evidence_id?: string
          id?: string
          learner_id?: string
          metadata?: Json
          occurred_at?: string
          processed_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "evidence_projection_events_evidence_id_fkey"
            columns: ["evidence_id"]
            isOneToOne: false
            referencedRelation: "learner_evidence"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "evidence_projection_events_learner_id_fkey"
            columns: ["learner_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      feature_requests: {
        Row: {
          admin_notes: string | null
          category: string
          created_at: string
          description: string | null
          feature_title: string
          id: string
          status: string
          updated_at: string
          user_id: string | null
          votes: number
        }
        Insert: {
          admin_notes?: string | null
          category: string
          created_at?: string
          description?: string | null
          feature_title: string
          id?: string
          status?: string
          updated_at?: string
          user_id?: string | null
          votes?: number
        }
        Update: {
          admin_notes?: string | null
          category?: string
          created_at?: string
          description?: string | null
          feature_title?: string
          id?: string
          status?: string
          updated_at?: string
          user_id?: string | null
          votes?: number
        }
        Relationships: []
      }
      feature_votes: {
        Row: {
          created_at: string
          feature_id: string
          id: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          feature_id: string
          id?: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          feature_id?: string
          id?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "feature_votes_feature_id_fkey"
            columns: ["feature_id"]
            isOneToOne: false
            referencedRelation: "feature_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      formative_signals: {
        Row: {
          class_id: string
          confused_ids: Json
          created_at: string | null
          got_it_ids: Json
          id: string
          lesson_number: number | null
          lesson_plan_id: string | null
          lost_ids: Json
          recorded_at: string | null
          sow_id: string | null
          strand: string | null
          sub_strand: string | null
          subject: string
          teacher_id: string
          teacher_note: string | null
          week_number: number | null
        }
        Insert: {
          class_id: string
          confused_ids?: Json
          created_at?: string | null
          got_it_ids?: Json
          id?: string
          lesson_number?: number | null
          lesson_plan_id?: string | null
          lost_ids?: Json
          recorded_at?: string | null
          sow_id?: string | null
          strand?: string | null
          sub_strand?: string | null
          subject: string
          teacher_id: string
          teacher_note?: string | null
          week_number?: number | null
        }
        Update: {
          class_id?: string
          confused_ids?: Json
          created_at?: string | null
          got_it_ids?: Json
          id?: string
          lesson_number?: number | null
          lesson_plan_id?: string | null
          lost_ids?: Json
          recorded_at?: string | null
          sow_id?: string | null
          strand?: string | null
          sub_strand?: string | null
          subject?: string
          teacher_id?: string
          teacher_note?: string | null
          week_number?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "formative_signals_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "teacher_classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "formative_signals_lesson_plan_id_fkey"
            columns: ["lesson_plan_id"]
            isOneToOne: false
            referencedRelation: "lesson_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "formative_signals_sow_id_fkey"
            columns: ["sow_id"]
            isOneToOne: false
            referencedRelation: "schemes_of_work"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "formative_signals_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "teachers"
            referencedColumns: ["id"]
          },
        ]
      }
      generation_jobs: {
        Row: {
          completed_at: string | null
          created_at: string | null
          error_message: string | null
          id: string
          job_type: string | null
          sow_id: string | null
          status: string | null
          teacher_id: string | null
          triggered_at: string | null
          updated_at: string | null
          week_number: number | null
        }
        Insert: {
          completed_at?: string | null
          created_at?: string | null
          error_message?: string | null
          id?: string
          job_type?: string | null
          sow_id?: string | null
          status?: string | null
          teacher_id?: string | null
          triggered_at?: string | null
          updated_at?: string | null
          week_number?: number | null
        }
        Update: {
          completed_at?: string | null
          created_at?: string | null
          error_message?: string | null
          id?: string
          job_type?: string | null
          sow_id?: string | null
          status?: string | null
          teacher_id?: string | null
          triggered_at?: string | null
          updated_at?: string | null
          week_number?: number | null
        }
        Relationships: []
      }
      grade_subjects: {
        Row: {
          created_at: string
          grade_id: string
          id: string
          is_compulsory: boolean
          school_id: string
          subject_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          grade_id: string
          id?: string
          is_compulsory?: boolean
          school_id: string
          subject_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          grade_id?: string
          id?: string
          is_compulsory?: boolean
          school_id?: string
          subject_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "grade_subjects_grade_id_fkey"
            columns: ["grade_id"]
            isOneToOne: false
            referencedRelation: "grades"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "grade_subjects_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "grade_subjects_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
        ]
      }
      grades: {
        Row: {
          category: string
          code: string
          created_at: string
          id: string
          level_order: number
          name: string
          updated_at: string
        }
        Insert: {
          category: string
          code: string
          created_at?: string
          id?: string
          level_order: number
          name: string
          updated_at?: string
        }
        Update: {
          category?: string
          code?: string
          created_at?: string
          id?: string
          level_order?: number
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      holiday_plans: {
        Row: {
          created_at: string | null
          holiday_days: number
          holiday_period: string
          id: string
          is_published: boolean
          parent_opened_at: string | null
          plan_data: Json
          published_at: string | null
          school_id: string | null
          student_id: string
          teacher_id: string | null
          term: number
          updated_at: string | null
          whatsapp_sent: boolean | null
          whatsapp_sent_at: string | null
          year: number
        }
        Insert: {
          created_at?: string | null
          holiday_days?: number
          holiday_period: string
          id?: string
          is_published?: boolean
          parent_opened_at?: string | null
          plan_data?: Json
          published_at?: string | null
          school_id?: string | null
          student_id: string
          teacher_id?: string | null
          term: number
          updated_at?: string | null
          whatsapp_sent?: boolean | null
          whatsapp_sent_at?: string | null
          year: number
        }
        Update: {
          created_at?: string | null
          holiday_days?: number
          holiday_period?: string
          id?: string
          is_published?: boolean
          parent_opened_at?: string | null
          plan_data?: Json
          published_at?: string | null
          school_id?: string | null
          student_id?: string
          teacher_id?: string | null
          term?: number
          updated_at?: string | null
          whatsapp_sent?: boolean | null
          whatsapp_sent_at?: string | null
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "holiday_plans_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "holiday_plans_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "holiday_plans_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "teachers"
            referencedColumns: ["id"]
          },
        ]
      }
      holiday_returns: {
        Row: {
          created_at: string
          id: string
          ingestion_run_id: string | null
          student_id: string
          teacher_comment: string | null
          teacher_id: string
          term: number
          updated_at: string
          weeks_assigned: number
          weeks_completed: number
          year: number
        }
        Insert: {
          created_at?: string
          id?: string
          ingestion_run_id?: string | null
          student_id: string
          teacher_comment?: string | null
          teacher_id: string
          term: number
          updated_at?: string
          weeks_assigned: number
          weeks_completed: number
          year: number
        }
        Update: {
          created_at?: string
          id?: string
          ingestion_run_id?: string | null
          student_id?: string
          teacher_comment?: string | null
          teacher_id?: string
          term?: number
          updated_at?: string
          weeks_assigned?: number
          weeks_completed?: number
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "holiday_returns_ingestion_run_id_fkey"
            columns: ["ingestion_run_id"]
            isOneToOne: false
            referencedRelation: "ingestion_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "holiday_returns_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "holiday_returns_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "teachers"
            referencedColumns: ["id"]
          },
        ]
      }
      ingestion_runs: {
        Row: {
          completed_at: string | null
          confirmed_count: number
          created_at: string
          failure_reason: string | null
          id: string
          initiated_by: string
          institution: string | null
          pending_review_count: number
          processing_duration_ms: number | null
          record_count: number
          rejected_count: number
          source: string
          started_at: string
          status: string
          teacher_id: string | null
        }
        Insert: {
          completed_at?: string | null
          confirmed_count?: number
          created_at?: string
          failure_reason?: string | null
          id?: string
          initiated_by: string
          institution?: string | null
          pending_review_count?: number
          processing_duration_ms?: number | null
          record_count?: number
          rejected_count?: number
          source: string
          started_at?: string
          status?: string
          teacher_id?: string | null
        }
        Update: {
          completed_at?: string | null
          confirmed_count?: number
          created_at?: string
          failure_reason?: string | null
          id?: string
          initiated_by?: string
          institution?: string | null
          pending_review_count?: number
          processing_duration_ms?: number | null
          record_count?: number
          rejected_count?: number
          source?: string
          started_at?: string
          status?: string
          teacher_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ingestion_runs_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "teachers"
            referencedColumns: ["id"]
          },
        ]
      }
      insights_article_tags: {
        Row: {
          article_id: string
          tag_id: string
        }
        Insert: {
          article_id: string
          tag_id: string
        }
        Update: {
          article_id?: string
          tag_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "insights_article_tags_article_id_fkey"
            columns: ["article_id"]
            isOneToOne: false
            referencedRelation: "insights_articles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "insights_article_tags_tag_id_fkey"
            columns: ["tag_id"]
            isOneToOne: false
            referencedRelation: "insights_tags"
            referencedColumns: ["id"]
          },
        ]
      }
      insights_articles: {
        Row: {
          author_id: string
          category_id: string
          content: string | null
          content_type: string
          cover_image: string | null
          created_at: string
          excerpt: string | null
          featured: boolean
          id: string
          og_image: string | null
          pinned: boolean
          publish_date: string | null
          reading_time: number
          search_vector: unknown
          seo_description: string | null
          seo_title: string | null
          series_id: string | null
          series_order: number | null
          slug: string
          status: string
          subtitle: string | null
          title: string
          updated_at: string
          view_count: number
        }
        Insert: {
          author_id: string
          category_id: string
          content?: string | null
          content_type?: string
          cover_image?: string | null
          created_at?: string
          excerpt?: string | null
          featured?: boolean
          id?: string
          og_image?: string | null
          pinned?: boolean
          publish_date?: string | null
          reading_time?: number
          search_vector?: unknown
          seo_description?: string | null
          seo_title?: string | null
          series_id?: string | null
          series_order?: number | null
          slug: string
          status?: string
          subtitle?: string | null
          title: string
          updated_at?: string
          view_count?: number
        }
        Update: {
          author_id?: string
          category_id?: string
          content?: string | null
          content_type?: string
          cover_image?: string | null
          created_at?: string
          excerpt?: string | null
          featured?: boolean
          id?: string
          og_image?: string | null
          pinned?: boolean
          publish_date?: string | null
          reading_time?: number
          search_vector?: unknown
          seo_description?: string | null
          seo_title?: string | null
          series_id?: string | null
          series_order?: number | null
          slug?: string
          status?: string
          subtitle?: string | null
          title?: string
          updated_at?: string
          view_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "insights_articles_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "insights_authors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "insights_articles_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "insights_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "insights_articles_series_id_fkey"
            columns: ["series_id"]
            isOneToOne: false
            referencedRelation: "insights_series"
            referencedColumns: ["id"]
          },
        ]
      }
      insights_authors: {
        Row: {
          avatar_url: string | null
          bio: string | null
          created_at: string
          id: string
          name: string
          slug: string
          social_links: Json
          title: string | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          id?: string
          name: string
          slug: string
          social_links?: Json
          title?: string | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          id?: string
          name?: string
          slug?: string
          social_links?: Json
          title?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      insights_categories: {
        Row: {
          color: string
          created_at: string
          description: string | null
          id: string
          name: string
          slug: string
          updated_at: string
        }
        Insert: {
          color?: string
          created_at?: string
          description?: string | null
          id?: string
          name: string
          slug: string
          updated_at?: string
        }
        Update: {
          color?: string
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          slug?: string
          updated_at?: string
        }
        Relationships: []
      }
      insights_newsletter_subscribers: {
        Row: {
          confirmed: boolean
          created_at: string
          email: string
          id: string
          updated_at: string
        }
        Insert: {
          confirmed?: boolean
          created_at?: string
          email: string
          id?: string
          updated_at?: string
        }
        Update: {
          confirmed?: boolean
          created_at?: string
          email?: string
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      insights_series: {
        Row: {
          cover_image: string | null
          created_at: string
          description: string | null
          id: string
          slug: string
          title: string
          updated_at: string
        }
        Insert: {
          cover_image?: string | null
          created_at?: string
          description?: string | null
          id?: string
          slug: string
          title: string
          updated_at?: string
        }
        Update: {
          cover_image?: string | null
          created_at?: string
          description?: string | null
          id?: string
          slug?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      insights_tags: {
        Row: {
          created_at: string
          id: string
          name: string
          slug: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          slug: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          slug?: string
        }
        Relationships: []
      }
      integration_connections: {
        Row: {
          config: Json
          created_at: string
          developer_id: string
          id: string
          integration_type: string
          last_sync_at: string | null
          name: string
          status: string
          teacher_id: string | null
          updated_at: string
        }
        Insert: {
          config?: Json
          created_at?: string
          developer_id: string
          id?: string
          integration_type: string
          last_sync_at?: string | null
          name: string
          status?: string
          teacher_id?: string | null
          updated_at?: string
        }
        Update: {
          config?: Json
          created_at?: string
          developer_id?: string
          id?: string
          integration_type?: string
          last_sync_at?: string | null
          name?: string
          status?: string
          teacher_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "integration_connections_developer_id_fkey"
            columns: ["developer_id"]
            isOneToOne: false
            referencedRelation: "developer_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "integration_connections_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "teachers"
            referencedColumns: ["id"]
          },
        ]
      }
      intervention_log: {
        Row: {
          checkin_completed_at: string | null
          checkin_due_at: string
          class_id: string | null
          created_at: string
          id: string
          intervened_at: string
          intervention_type: string
          knowledge_level_after: number | null
          knowledge_level_before: number | null
          risk_level_after: string | null
          risk_level_before: string | null
          student_id: string
          substrand: string | null
          teacher_id: string
          teacher_note: string | null
          teacher_outcome: string | null
          updated_at: string
          was_effective: boolean | null
        }
        Insert: {
          checkin_completed_at?: string | null
          checkin_due_at?: string
          class_id?: string | null
          created_at?: string
          id?: string
          intervened_at?: string
          intervention_type: string
          knowledge_level_after?: number | null
          knowledge_level_before?: number | null
          risk_level_after?: string | null
          risk_level_before?: string | null
          student_id: string
          substrand?: string | null
          teacher_id: string
          teacher_note?: string | null
          teacher_outcome?: string | null
          updated_at?: string
          was_effective?: boolean | null
        }
        Update: {
          checkin_completed_at?: string | null
          checkin_due_at?: string
          class_id?: string | null
          created_at?: string
          id?: string
          intervened_at?: string
          intervention_type?: string
          knowledge_level_after?: number | null
          knowledge_level_before?: number | null
          risk_level_after?: string | null
          risk_level_before?: string | null
          student_id?: string
          substrand?: string | null
          teacher_id?: string
          teacher_note?: string | null
          teacher_outcome?: string | null
          updated_at?: string
          was_effective?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "intervention_log_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "teacher_classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "intervention_log_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      kicd_curriculum_lessons: {
        Row: {
          assessment_methods: Json | null
          confidence_score: number | null
          core_competencies: string | null
          created_at: string | null
          grade_id: string | null
          id: string
          is_kicd_official: boolean | null
          key_inquiry_questions: Json | null
          learning_area_id: string | null
          learning_experiences: Json | null
          learning_resources: Json | null
          pci_links: string | null
          source_document: string | null
          substrand_id: string | null
          topic_specific_learning_outcomes: Json | null
          updated_at: string | null
          values: string | null
        }
        Insert: {
          assessment_methods?: Json | null
          confidence_score?: number | null
          core_competencies?: string | null
          created_at?: string | null
          grade_id?: string | null
          id?: string
          is_kicd_official?: boolean | null
          key_inquiry_questions?: Json | null
          learning_area_id?: string | null
          learning_experiences?: Json | null
          learning_resources?: Json | null
          pci_links?: string | null
          source_document?: string | null
          substrand_id?: string | null
          topic_specific_learning_outcomes?: Json | null
          updated_at?: string | null
          values?: string | null
        }
        Update: {
          assessment_methods?: Json | null
          confidence_score?: number | null
          core_competencies?: string | null
          created_at?: string | null
          grade_id?: string | null
          id?: string
          is_kicd_official?: boolean | null
          key_inquiry_questions?: Json | null
          learning_area_id?: string | null
          learning_experiences?: Json | null
          learning_resources?: Json | null
          pci_links?: string | null
          source_document?: string | null
          substrand_id?: string | null
          topic_specific_learning_outcomes?: Json | null
          updated_at?: string | null
          values?: string | null
        }
        Relationships: []
      }
      knowledge_edges: {
        Row: {
          created_at: string
          cross_grade: boolean
          dependency_type: string
          dependent_node_id: string
          id: string
          notes: string | null
          prerequisite_node_id: string
          weight: number
        }
        Insert: {
          created_at?: string
          cross_grade?: boolean
          dependency_type: string
          dependent_node_id: string
          id?: string
          notes?: string | null
          prerequisite_node_id: string
          weight: number
        }
        Update: {
          created_at?: string
          cross_grade?: boolean
          dependency_type?: string
          dependent_node_id?: string
          id?: string
          notes?: string | null
          prerequisite_node_id?: string
          weight?: number
        }
        Relationships: [
          {
            foreignKeyName: "knowledge_edges_dependent_node_id_fkey"
            columns: ["dependent_node_id"]
            isOneToOne: false
            referencedRelation: "knowledge_nodes"
            referencedColumns: ["node_id"]
          },
          {
            foreignKeyName: "knowledge_edges_prerequisite_node_id_fkey"
            columns: ["prerequisite_node_id"]
            isOneToOne: false
            referencedRelation: "knowledge_nodes"
            referencedColumns: ["node_id"]
          },
        ]
      }
      knowledge_nodes: {
        Row: {
          career_relevance: string[]
          core_concepts: string[]
          created_at: string
          grade: number
          id: string
          importance: string
          level: string
          misconceptions: string[]
          name: string
          node_id: string
          node_type: string
          parent_node_id: string | null
          remediation: string[]
          strand: string
          subject: string
          updated_at: string
          weak_mastery_signs: string[]
        }
        Insert: {
          career_relevance?: string[]
          core_concepts?: string[]
          created_at?: string
          grade: number
          id?: string
          importance: string
          level: string
          misconceptions?: string[]
          name: string
          node_id: string
          node_type: string
          parent_node_id?: string | null
          remediation?: string[]
          strand: string
          subject: string
          updated_at?: string
          weak_mastery_signs?: string[]
        }
        Update: {
          career_relevance?: string[]
          core_concepts?: string[]
          created_at?: string
          grade?: number
          id?: string
          importance?: string
          level?: string
          misconceptions?: string[]
          name?: string
          node_id?: string
          node_type?: string
          parent_node_id?: string | null
          remediation?: string[]
          strand?: string
          subject?: string
          updated_at?: string
          weak_mastery_signs?: string[]
        }
        Relationships: [
          {
            foreignKeyName: "knowledge_nodes_parent_node_id_fkey"
            columns: ["parent_node_id"]
            isOneToOne: false
            referencedRelation: "knowledge_nodes"
            referencedColumns: ["node_id"]
          },
        ]
      }
      learn_questions: {
        Row: {
          choices: Json | null
          correct_answer: string
          created_at: string | null
          difficulty: number
          feedback: string | null
          id: string
          is_correct: boolean | null
          phase: string
          question_number: number
          question_text: string
          question_type: string
          session_id: string
          student_answer: string | null
          time_taken_seconds: number | null
        }
        Insert: {
          choices?: Json | null
          correct_answer: string
          created_at?: string | null
          difficulty: number
          feedback?: string | null
          id?: string
          is_correct?: boolean | null
          phase: string
          question_number: number
          question_text: string
          question_type: string
          session_id: string
          student_answer?: string | null
          time_taken_seconds?: number | null
        }
        Update: {
          choices?: Json | null
          correct_answer?: string
          created_at?: string | null
          difficulty?: number
          feedback?: string | null
          id?: string
          is_correct?: boolean | null
          phase?: string
          question_number?: number
          question_text?: string
          question_type?: string
          session_id?: string
          student_answer?: string | null
          time_taken_seconds?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "learn_questions_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "learn_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      learn_sessions: {
        Row: {
          completed_at: string | null
          created_at: string | null
          current_difficulty: number | null
          current_phase: string | null
          grade: number
          id: string
          mastery_score: number | null
          overall_level: number
          questions_attempted: number | null
          questions_correct: number | null
          right_streak: number | null
          started_at: string | null
          status: string | null
          student_id: string
          subject: string
          topic: string
          topic_display: string
          updated_at: string | null
          wrong_streak: number | null
        }
        Insert: {
          completed_at?: string | null
          created_at?: string | null
          current_difficulty?: number | null
          current_phase?: string | null
          grade: number
          id?: string
          mastery_score?: number | null
          overall_level?: number
          questions_attempted?: number | null
          questions_correct?: number | null
          right_streak?: number | null
          started_at?: string | null
          status?: string | null
          student_id: string
          subject: string
          topic: string
          topic_display: string
          updated_at?: string | null
          wrong_streak?: number | null
        }
        Update: {
          completed_at?: string | null
          created_at?: string | null
          current_difficulty?: number | null
          current_phase?: string | null
          grade?: number
          id?: string
          mastery_score?: number | null
          overall_level?: number
          questions_attempted?: number | null
          questions_correct?: number | null
          right_streak?: number | null
          started_at?: string | null
          status?: string | null
          student_id?: string
          subject?: string
          topic?: string
          topic_display?: string
          updated_at?: string | null
          wrong_streak?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "learn_sessions_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      learner_enrollments: {
        Row: {
          academic_year_id: string
          class_id: string
          created_at: string
          enrollment_date: string
          id: string
          learner_id: string
          school_id: string
          status: string
          term_id: string
          updated_at: string
        }
        Insert: {
          academic_year_id: string
          class_id: string
          created_at?: string
          enrollment_date?: string
          id?: string
          learner_id: string
          school_id: string
          status?: string
          term_id: string
          updated_at?: string
        }
        Update: {
          academic_year_id?: string
          class_id?: string
          created_at?: string
          enrollment_date?: string
          id?: string
          learner_id?: string
          school_id?: string
          status?: string
          term_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "learner_enrollments_academic_year_id_fkey"
            columns: ["academic_year_id"]
            isOneToOne: false
            referencedRelation: "academic_years"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "learner_enrollments_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "learner_enrollments_learner_id_fkey"
            columns: ["learner_id"]
            isOneToOne: false
            referencedRelation: "learners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "learner_enrollments_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "learner_enrollments_term_id_fkey"
            columns: ["term_id"]
            isOneToOne: false
            referencedRelation: "terms"
            referencedColumns: ["id"]
          },
        ]
      }
      learner_evidence: {
        Row: {
          academic_year: number
          assessment_type: string
          cbc_level: number | null
          confidence_formula_version: string
          created_at: string
          evidence_confidence: number
          evidence_source: string
          extracted_external_id: string | null
          extracted_name: string
          extraction_method: string
          id: string
          ingestion_run_id: string
          issues: Json
          learner_id: string | null
          lifecycle_state: string
          raw_input_ref: string
          raw_subject: string
          retracted_at: string | null
          retracted_by: string | null
          retraction_reason: string | null
          review_reason: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          score: number | null
          subject: string
          superseded_by: string | null
          supersedes: string | null
          term: number | null
          trust_tier: number
          updated_at: string
          verification_state: string
        }
        Insert: {
          academic_year: number
          assessment_type: string
          cbc_level?: number | null
          confidence_formula_version?: string
          created_at?: string
          evidence_confidence: number
          evidence_source: string
          extracted_external_id?: string | null
          extracted_name: string
          extraction_method: string
          id?: string
          ingestion_run_id: string
          issues?: Json
          learner_id?: string | null
          lifecycle_state: string
          raw_input_ref: string
          raw_subject: string
          retracted_at?: string | null
          retracted_by?: string | null
          retraction_reason?: string | null
          review_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          score?: number | null
          subject: string
          superseded_by?: string | null
          supersedes?: string | null
          term?: number | null
          trust_tier: number
          updated_at?: string
          verification_state?: string
        }
        Update: {
          academic_year?: number
          assessment_type?: string
          cbc_level?: number | null
          confidence_formula_version?: string
          created_at?: string
          evidence_confidence?: number
          evidence_source?: string
          extracted_external_id?: string | null
          extracted_name?: string
          extraction_method?: string
          id?: string
          ingestion_run_id?: string
          issues?: Json
          learner_id?: string | null
          lifecycle_state?: string
          raw_input_ref?: string
          raw_subject?: string
          retracted_at?: string | null
          retracted_by?: string | null
          retraction_reason?: string | null
          review_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          score?: number | null
          subject?: string
          superseded_by?: string | null
          supersedes?: string | null
          term?: number | null
          trust_tier?: number
          updated_at?: string
          verification_state?: string
        }
        Relationships: [
          {
            foreignKeyName: "learner_evidence_ingestion_run_id_fkey"
            columns: ["ingestion_run_id"]
            isOneToOne: false
            referencedRelation: "ingestion_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "learner_evidence_learner_id_fkey"
            columns: ["learner_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "learner_evidence_superseded_by_fkey"
            columns: ["superseded_by"]
            isOneToOne: false
            referencedRelation: "learner_evidence"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "learner_evidence_supersedes_fkey"
            columns: ["supersedes"]
            isOneToOne: false
            referencedRelation: "learner_evidence"
            referencedColumns: ["id"]
          },
        ]
      }
      learner_guardians: {
        Row: {
          can_receive_reports: boolean
          created_at: string
          email: string | null
          full_name: string
          id: string
          is_primary: boolean
          learner_id: string
          national_id: string | null
          phone: string
          relationship: string
          school_id: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          can_receive_reports?: boolean
          created_at?: string
          email?: string | null
          full_name: string
          id?: string
          is_primary?: boolean
          learner_id: string
          national_id?: string | null
          phone: string
          relationship: string
          school_id: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          can_receive_reports?: boolean
          created_at?: string
          email?: string | null
          full_name?: string
          id?: string
          is_primary?: boolean
          learner_id?: string
          national_id?: string | null
          phone?: string
          relationship?: string
          school_id?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "learner_guardians_learner_id_fkey"
            columns: ["learner_id"]
            isOneToOne: false
            referencedRelation: "learners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "learner_guardians_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      learner_marks: {
        Row: {
          admission_number: string | null
          assessment_id: string
          class_id: string
          created_at: string | null
          id: string
          mean_grade: string | null
          mean_score: number | null
          position: number | null
          student_id: string | null
          student_name: string
          subject_scores: Json
          teacher_id: string
          total_marks: number | null
          updated_at: string | null
        }
        Insert: {
          admission_number?: string | null
          assessment_id: string
          class_id: string
          created_at?: string | null
          id?: string
          mean_grade?: string | null
          mean_score?: number | null
          position?: number | null
          student_id?: string | null
          student_name: string
          subject_scores?: Json
          teacher_id: string
          total_marks?: number | null
          updated_at?: string | null
        }
        Update: {
          admission_number?: string | null
          assessment_id?: string
          class_id?: string
          created_at?: string | null
          id?: string
          mean_grade?: string | null
          mean_score?: number | null
          position?: number | null
          student_id?: string | null
          student_name?: string
          subject_scores?: Json
          teacher_id?: string
          total_marks?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "learner_marks_assessment_id_fkey"
            columns: ["assessment_id"]
            isOneToOne: false
            referencedRelation: "class_assessments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "learner_marks_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "teacher_classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "learner_marks_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "learner_marks_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "teachers"
            referencedColumns: ["id"]
          },
        ]
      }
      learner_profiles: {
        Row: {
          capability_dimensions: Json
          career_signals: Json
          confirmed_gaps: string[] | null
          created_at: string
          current_term: number | null
          current_year: number | null
          engagement_patterns: Json
          formative_signals: Json
          growth_milestones: Json | null
          id: string
          interests: Json | null
          knowledge_state: Json
          last_assessment_date: string | null
          learning_behaviour: Json | null
          learning_style: string | null
          overall_risk_level: string
          parent_observations: Json | null
          pathway_readiness: Json | null
          persistent_gaps: string[] | null
          profile_data: Json | null
          risk_flags: Json
          risk_history: Json | null
          strengths: Json | null
          student_id: string
          term_snapshots: Json | null
          updated_at: string
          weaknesses: Json | null
        }
        Insert: {
          capability_dimensions?: Json
          career_signals?: Json
          confirmed_gaps?: string[] | null
          created_at?: string
          current_term?: number | null
          current_year?: number | null
          engagement_patterns?: Json
          formative_signals?: Json
          growth_milestones?: Json | null
          id?: string
          interests?: Json | null
          knowledge_state?: Json
          last_assessment_date?: string | null
          learning_behaviour?: Json | null
          learning_style?: string | null
          overall_risk_level?: string
          parent_observations?: Json | null
          pathway_readiness?: Json | null
          persistent_gaps?: string[] | null
          profile_data?: Json | null
          risk_flags?: Json
          risk_history?: Json | null
          strengths?: Json | null
          student_id: string
          term_snapshots?: Json | null
          updated_at?: string
          weaknesses?: Json | null
        }
        Update: {
          capability_dimensions?: Json
          career_signals?: Json
          confirmed_gaps?: string[] | null
          created_at?: string
          current_term?: number | null
          current_year?: number | null
          engagement_patterns?: Json
          formative_signals?: Json
          growth_milestones?: Json | null
          id?: string
          interests?: Json | null
          knowledge_state?: Json
          last_assessment_date?: string | null
          learning_behaviour?: Json | null
          learning_style?: string | null
          overall_risk_level?: string
          parent_observations?: Json | null
          pathway_readiness?: Json | null
          persistent_gaps?: string[] | null
          profile_data?: Json | null
          risk_flags?: Json
          risk_history?: Json | null
          strengths?: Json | null
          student_id?: string
          term_snapshots?: Json | null
          updated_at?: string
          weaknesses?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "learner_profiles_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: true
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      learner_projections: {
        Row: {
          confidence: number
          coverage: number | null
          created_at: string
          evidence_count: number
          evidence_diversity: number
          freshness_days: number | null
          id: string
          last_computed: string
          latest_evidence_at: string | null
          learner_id: string
          oldest_evidence_at: string | null
          projection_version: string
          projector_type: string
          supporting_evidence_ids: string[]
          value: Json
        }
        Insert: {
          confidence: number
          coverage?: number | null
          created_at?: string
          evidence_count?: number
          evidence_diversity?: number
          freshness_days?: number | null
          id?: string
          last_computed?: string
          latest_evidence_at?: string | null
          learner_id: string
          oldest_evidence_at?: string | null
          projection_version: string
          projector_type: string
          supporting_evidence_ids?: string[]
          value: Json
        }
        Update: {
          confidence?: number
          coverage?: number | null
          created_at?: string
          evidence_count?: number
          evidence_diversity?: number
          freshness_days?: number | null
          id?: string
          last_computed?: string
          latest_evidence_at?: string | null
          learner_id?: string
          oldest_evidence_at?: string | null
          projection_version?: string
          projector_type?: string
          supporting_evidence_ids?: string[]
          value?: Json
        }
        Relationships: [
          {
            foreignKeyName: "learner_projections_learner_id_fkey"
            columns: ["learner_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      learner_promotions: {
        Row: {
          created_at: string
          from_academic_year_id: string
          from_class_id: string
          id: string
          learner_id: string
          notes: string | null
          processed_by: string
          promoted_at: string
          promotion_type: string
          school_id: string
          to_academic_year_id: string | null
          to_class_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          from_academic_year_id: string
          from_class_id: string
          id?: string
          learner_id: string
          notes?: string | null
          processed_by: string
          promoted_at?: string
          promotion_type: string
          school_id: string
          to_academic_year_id?: string | null
          to_class_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          from_academic_year_id?: string
          from_class_id?: string
          id?: string
          learner_id?: string
          notes?: string | null
          processed_by?: string
          promoted_at?: string
          promotion_type?: string
          school_id?: string
          to_academic_year_id?: string | null
          to_class_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "learner_promotions_from_academic_year_id_fkey"
            columns: ["from_academic_year_id"]
            isOneToOne: false
            referencedRelation: "academic_years"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "learner_promotions_from_class_id_fkey"
            columns: ["from_class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "learner_promotions_learner_id_fkey"
            columns: ["learner_id"]
            isOneToOne: false
            referencedRelation: "learners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "learner_promotions_processed_by_fkey"
            columns: ["processed_by"]
            isOneToOne: false
            referencedRelation: "school_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "learner_promotions_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "learner_promotions_to_academic_year_id_fkey"
            columns: ["to_academic_year_id"]
            isOneToOne: false
            referencedRelation: "academic_years"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "learner_promotions_to_class_id_fkey"
            columns: ["to_class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
        ]
      }
      learner_transfers: {
        Row: {
          created_at: string
          direction: string
          document_urls: string[]
          from_school_id: string
          id: string
          learner_id: string
          processed_by: string
          reason: string | null
          to_school_id: string | null
          to_school_name: string | null
          transfer_date: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          direction: string
          document_urls?: string[]
          from_school_id: string
          id?: string
          learner_id: string
          processed_by: string
          reason?: string | null
          to_school_id?: string | null
          to_school_name?: string | null
          transfer_date: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          direction?: string
          document_urls?: string[]
          from_school_id?: string
          id?: string
          learner_id?: string
          processed_by?: string
          reason?: string | null
          to_school_id?: string | null
          to_school_name?: string | null
          transfer_date?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "learner_transfers_from_school_id_fkey"
            columns: ["from_school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "learner_transfers_learner_id_fkey"
            columns: ["learner_id"]
            isOneToOne: false
            referencedRelation: "learners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "learner_transfers_processed_by_fkey"
            columns: ["processed_by"]
            isOneToOne: false
            referencedRelation: "school_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "learner_transfers_to_school_id_fkey"
            columns: ["to_school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      learners: {
        Row: {
          admission_date: string
          admission_number: string
          county_of_origin: string | null
          created_at: string
          date_of_birth: string | null
          first_name: string
          gender: string | null
          graduation_date: string | null
          id: string
          last_name: string
          middle_name: string | null
          nationality: string
          notes: string | null
          photo_url: string | null
          school_id: string
          special_needs: string[]
          status: string
          updated_at: string
          upi: string | null
        }
        Insert: {
          admission_date?: string
          admission_number: string
          county_of_origin?: string | null
          created_at?: string
          date_of_birth?: string | null
          first_name: string
          gender?: string | null
          graduation_date?: string | null
          id?: string
          last_name: string
          middle_name?: string | null
          nationality?: string
          notes?: string | null
          photo_url?: string | null
          school_id: string
          special_needs?: string[]
          status?: string
          updated_at?: string
          upi?: string | null
        }
        Update: {
          admission_date?: string
          admission_number?: string
          county_of_origin?: string | null
          created_at?: string
          date_of_birth?: string | null
          first_name?: string
          gender?: string | null
          graduation_date?: string | null
          id?: string
          last_name?: string
          middle_name?: string | null
          nationality?: string
          notes?: string | null
          photo_url?: string | null
          school_id?: string
          special_needs?: string[]
          status?: string
          updated_at?: string
          upi?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "learners_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      learning_compass_configs: {
        Row: {
          active: boolean | null
          adaptive_tier: string
          clinic_report_id: string | null
          completed: boolean | null
          completed_at: string | null
          created_at: string | null
          daily_duration_minutes: number | null
          daily_schedule: string
          enabled: boolean | null
          expected_improvement: Json
          focus_subjects: string[]
          focus_subjects_display: string[]
          id: string
          main_lesson_minutes: number | null
          parent_updates: string | null
          practice_minutes: number | null
          review_minutes: number | null
          student_id: string
          target_date: string
          updated_at: string | null
          warm_up_minutes: number | null
        }
        Insert: {
          active?: boolean | null
          adaptive_tier: string
          clinic_report_id?: string | null
          completed?: boolean | null
          completed_at?: string | null
          created_at?: string | null
          daily_duration_minutes?: number | null
          daily_schedule: string
          enabled?: boolean | null
          expected_improvement: Json
          focus_subjects: string[]
          focus_subjects_display: string[]
          id?: string
          main_lesson_minutes?: number | null
          parent_updates?: string | null
          practice_minutes?: number | null
          review_minutes?: number | null
          student_id: string
          target_date: string
          updated_at?: string | null
          warm_up_minutes?: number | null
        }
        Update: {
          active?: boolean | null
          adaptive_tier?: string
          clinic_report_id?: string | null
          completed?: boolean | null
          completed_at?: string | null
          created_at?: string | null
          daily_duration_minutes?: number | null
          daily_schedule?: string
          enabled?: boolean | null
          expected_improvement?: Json
          focus_subjects?: string[]
          focus_subjects_display?: string[]
          id?: string
          main_lesson_minutes?: number | null
          parent_updates?: string | null
          practice_minutes?: number | null
          review_minutes?: number | null
          student_id?: string
          target_date?: string
          updated_at?: string | null
          warm_up_minutes?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "learning_compass_configs_clinic_report_id_fkey"
            columns: ["clinic_report_id"]
            isOneToOne: false
            referencedRelation: "clinic_reports"
            referencedColumns: ["id"]
          },
        ]
      }
      learning_compass_state: {
        Row: {
          created_at: string | null
          current_tier: string | null
          id: string
          mastered_concepts: string[] | null
          session_data: Json | null
          struggling_concepts: string[] | null
          student_id: string
          subject_tiers: Json | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          current_tier?: string | null
          id?: string
          mastered_concepts?: string[] | null
          session_data?: Json | null
          struggling_concepts?: string[] | null
          student_id: string
          subject_tiers?: Json | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          current_tier?: string | null
          id?: string
          mastered_concepts?: string[] | null
          session_data?: Json | null
          struggling_concepts?: string[] | null
          student_id?: string
          subject_tiers?: Json | null
          updated_at?: string | null
        }
        Relationships: []
      }
      learning_moments: {
        Row: {
          cognitive_load: string | null
          concept: string | null
          created_at: string | null
          id: string
          insight: string | null
          learner_id: string
          updated_at: string | null
        }
        Insert: {
          cognitive_load?: string | null
          concept?: string | null
          created_at?: string | null
          id?: string
          insight?: string | null
          learner_id: string
          updated_at?: string | null
        }
        Update: {
          cognitive_load?: string | null
          concept?: string | null
          created_at?: string | null
          id?: string
          insight?: string | null
          learner_id?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      lesson_plans: {
        Row: {
          conclusion: string | null
          created_at: string | null
          extended_activities: string | null
          generated_at: string | null
          id: string
          introduction: string | null
          key_inquiry_questions: Json | null
          learning_outcomes: Json | null
          learning_resources: Json | null
          lesson_number: number
          organisation_of_learning: string | null
          reflection: string | null
          reflection_source: string | null
          roll_count: number | null
          sow_id: string | null
          status: string | null
          step_1: string | null
          step_2: string | null
          step_3: string | null
          step_4: string | null
          strand: string | null
          sub_strand: string | null
          taught_date: string | null
          teacher_flagged_followup: string | null
          teacher_id: string | null
          teacher_self_evaluation: string | null
          time_taught: string | null
          updated_at: string | null
          week_number: number
        }
        Insert: {
          conclusion?: string | null
          created_at?: string | null
          extended_activities?: string | null
          generated_at?: string | null
          id?: string
          introduction?: string | null
          key_inquiry_questions?: Json | null
          learning_outcomes?: Json | null
          learning_resources?: Json | null
          lesson_number: number
          organisation_of_learning?: string | null
          reflection?: string | null
          reflection_source?: string | null
          roll_count?: number | null
          sow_id?: string | null
          status?: string | null
          step_1?: string | null
          step_2?: string | null
          step_3?: string | null
          step_4?: string | null
          strand?: string | null
          sub_strand?: string | null
          taught_date?: string | null
          teacher_flagged_followup?: string | null
          teacher_id?: string | null
          teacher_self_evaluation?: string | null
          time_taught?: string | null
          updated_at?: string | null
          week_number: number
        }
        Update: {
          conclusion?: string | null
          created_at?: string | null
          extended_activities?: string | null
          generated_at?: string | null
          id?: string
          introduction?: string | null
          key_inquiry_questions?: Json | null
          learning_outcomes?: Json | null
          learning_resources?: Json | null
          lesson_number?: number
          organisation_of_learning?: string | null
          reflection?: string | null
          reflection_source?: string | null
          roll_count?: number | null
          sow_id?: string | null
          status?: string | null
          step_1?: string | null
          step_2?: string | null
          step_3?: string | null
          step_4?: string | null
          strand?: string | null
          sub_strand?: string | null
          taught_date?: string | null
          teacher_flagged_followup?: string | null
          teacher_id?: string | null
          teacher_self_evaluation?: string | null
          time_taught?: string | null
          updated_at?: string | null
          week_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "lesson_plans_sow_id_fkey"
            columns: ["sow_id"]
            isOneToOne: false
            referencedRelation: "schemes_of_work"
            referencedColumns: ["id"]
          },
        ]
      }
      monday_panel_cache: {
        Row: {
          career_moments: Json | null
          class_id: string
          created_at: string
          generated_at: string
          id: string
          panel_data: Json
          pending_checkins: Json | null
          prerequisite_alerts: Json | null
          teacher_id: string
          teaching_patterns: Json | null
          valid_until: string
        }
        Insert: {
          career_moments?: Json | null
          class_id: string
          created_at?: string
          generated_at?: string
          id?: string
          panel_data?: Json
          pending_checkins?: Json | null
          prerequisite_alerts?: Json | null
          teacher_id: string
          teaching_patterns?: Json | null
          valid_until?: string
        }
        Update: {
          career_moments?: Json | null
          class_id?: string
          created_at?: string
          generated_at?: string
          id?: string
          panel_data?: Json
          pending_checkins?: Json | null
          prerequisite_alerts?: Json | null
          teacher_id?: string
          teaching_patterns?: Json | null
          valid_until?: string
        }
        Relationships: [
          {
            foreignKeyName: "monday_panel_cache_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: true
            referencedRelation: "teacher_classes"
            referencedColumns: ["id"]
          },
        ]
      }
      mpesa_payments: {
        Row: {
          amount: number | null
          checkout_id: string | null
          created_at: string | null
          id: string
          status: string | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          amount?: number | null
          checkout_id?: string | null
          created_at?: string | null
          id?: string
          status?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          amount?: number | null
          checkout_id?: string | null
          created_at?: string | null
          id?: string
          status?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      node_assessment_map: {
        Row: {
          created_at: string
          grade: number
          id: string
          node_id: string
          strand: string
          subject: string
          topic: string
        }
        Insert: {
          created_at?: string
          grade: number
          id?: string
          node_id: string
          strand: string
          subject: string
          topic: string
        }
        Update: {
          created_at?: string
          grade?: number
          id?: string
          node_id?: string
          strand?: string
          subject?: string
          topic?: string
        }
        Relationships: [
          {
            foreignKeyName: "node_assessment_map_node_id_fkey"
            columns: ["node_id"]
            isOneToOne: false
            referencedRelation: "knowledge_nodes"
            referencedColumns: ["node_id"]
          },
        ]
      }
      notification_log: {
        Row: {
          channel: string
          created_at: string | null
          email_address: string | null
          error_message: string | null
          id: string
          phone_number: string | null
          reference_id: string
          sent_at: string | null
          success: boolean | null
          type: string
          user_id: string | null
          whatsapp_message_id: string | null
        }
        Insert: {
          channel?: string
          created_at?: string | null
          email_address?: string | null
          error_message?: string | null
          id?: string
          phone_number?: string | null
          reference_id: string
          sent_at?: string | null
          success?: boolean | null
          type: string
          user_id?: string | null
          whatsapp_message_id?: string | null
        }
        Update: {
          channel?: string
          created_at?: string | null
          email_address?: string | null
          error_message?: string | null
          id?: string
          phone_number?: string | null
          reference_id?: string
          sent_at?: string | null
          success?: boolean | null
          type?: string
          user_id?: string | null
          whatsapp_message_id?: string | null
        }
        Relationships: []
      }
      parent_profiles: {
        Row: {
          children_count: number | null
          created_at: string | null
          id: string
          m_pesa_phone: string | null
          preferred_contact_method: string | null
          subscription_expires_at: string | null
          subscription_tier: string | null
          updated_at: string | null
        }
        Insert: {
          children_count?: number | null
          created_at?: string | null
          id: string
          m_pesa_phone?: string | null
          preferred_contact_method?: string | null
          subscription_expires_at?: string | null
          subscription_tier?: string | null
          updated_at?: string | null
        }
        Update: {
          children_count?: number | null
          created_at?: string | null
          id?: string
          m_pesa_phone?: string | null
          preferred_contact_method?: string | null
          subscription_expires_at?: string | null
          subscription_tier?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      pathway_analyses: {
        Row: {
          career_matches: Json | null
          created_at: string
          id: string
          recommended_pathway: string | null
          student_id: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          career_matches?: Json | null
          created_at?: string
          id?: string
          recommended_pathway?: string | null
          student_id: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          career_matches?: Json | null
          created_at?: string
          id?: string
          recommended_pathway?: string | null
          student_id?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pathway_analyses_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount: number
          created_at: string
          id: string
          metadata: Json | null
          product_id: string
          status: string
          transaction_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          id?: string
          metadata?: Json | null
          product_id: string
          status?: string
          transaction_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          metadata?: Json | null
          product_id?: string
          status?: string
          transaction_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      pilot_tracking: {
        Row: {
          created_at: string
          feedback_notes: string | null
          feedback_received_at: string | null
          id: string
          parent_name: string | null
          parent_phone: string | null
          student_id: string
          term: number
          updated_at: string
          whatsapp_sent_at: string | null
          year: number
        }
        Insert: {
          created_at?: string
          feedback_notes?: string | null
          feedback_received_at?: string | null
          id?: string
          parent_name?: string | null
          parent_phone?: string | null
          student_id: string
          term?: number
          updated_at?: string
          whatsapp_sent_at?: string | null
          year?: number
        }
        Update: {
          created_at?: string
          feedback_notes?: string | null
          feedback_received_at?: string | null
          id?: string
          parent_name?: string | null
          parent_phone?: string | null
          student_id?: string
          term?: number
          updated_at?: string
          whatsapp_sent_at?: string | null
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "pilot_tracking_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      platform_releases: {
        Row: {
          breaking_changes: Json
          changes: Json
          channel: string
          created_at: string
          deprecated_at: string | null
          id: string
          migration_guide: string | null
          published_at: string | null
          summary: string | null
          sunset_at: string | null
          title: string
          updated_at: string
          version: string
        }
        Insert: {
          breaking_changes?: Json
          changes?: Json
          channel?: string
          created_at?: string
          deprecated_at?: string | null
          id?: string
          migration_guide?: string | null
          published_at?: string | null
          summary?: string | null
          sunset_at?: string | null
          title: string
          updated_at?: string
          version: string
        }
        Update: {
          breaking_changes?: Json
          changes?: Json
          channel?: string
          created_at?: string
          deprecated_at?: string | null
          id?: string
          migration_guide?: string | null
          published_at?: string | null
          summary?: string | null
          sunset_at?: string | null
          title?: string
          updated_at?: string
          version?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          full_name: string | null
          id: string
          is_promoter: boolean
          onboarding_completed: boolean | null
          onboarding_completed_at: string | null
          plan_type: string | null
          role: string
          secondary_role: string | null
          tokens: number
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string | null
          id: string
          is_promoter?: boolean
          onboarding_completed?: boolean | null
          onboarding_completed_at?: string | null
          plan_type?: string | null
          role?: string
          secondary_role?: string | null
          tokens?: number
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          is_promoter?: boolean
          onboarding_completed?: boolean | null
          onboarding_completed_at?: string | null
          plan_type?: string | null
          role?: string
          secondary_role?: string | null
          tokens?: number
          updated_at?: string
        }
        Relationships: []
      }
      psychometric_assessments: {
        Row: {
          created_at: string
          holland_codes: Json | null
          id: string
          personality_type: string | null
          stress_tolerance: number | null
          student_id: string
          updated_at: string | null
          work_values: Json | null
        }
        Insert: {
          created_at?: string
          holland_codes?: Json | null
          id?: string
          personality_type?: string | null
          stress_tolerance?: number | null
          student_id: string
          updated_at?: string | null
          work_values?: Json | null
        }
        Update: {
          created_at?: string
          holland_codes?: Json | null
          id?: string
          personality_type?: string | null
          stress_tolerance?: number | null
          student_id?: string
          updated_at?: string | null
          work_values?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "psychometric_assessments_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      records_of_work: {
        Row: {
          created_at: string | null
          curriculum_mode: string | null
          grade: string
          id: string
          learning_area: string
          scheme_id: string | null
          school: string
          teacher_id: string
          teacher_name: string | null
          term: string
          updated_at: string | null
          year: number
        }
        Insert: {
          created_at?: string | null
          curriculum_mode?: string | null
          grade?: string
          id?: string
          learning_area?: string
          scheme_id?: string | null
          school?: string
          teacher_id: string
          teacher_name?: string | null
          term?: string
          updated_at?: string | null
          year?: number
        }
        Update: {
          created_at?: string | null
          curriculum_mode?: string | null
          grade?: string
          id?: string
          learning_area?: string
          scheme_id?: string | null
          school?: string
          teacher_id?: string
          teacher_name?: string | null
          term?: string
          updated_at?: string | null
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "records_of_work_scheme_id_fkey"
            columns: ["scheme_id"]
            isOneToOne: true
            referencedRelation: "schemes_of_work"
            referencedColumns: ["id"]
          },
        ]
      }
      referral_rewards: {
        Row: {
          claimed: boolean | null
          created_at: string | null
          id: string
          reason: string | null
          referral_id: string
          tokens_earned: number
          updated_at: string | null
          user_id: string
        }
        Insert: {
          claimed?: boolean | null
          created_at?: string | null
          id?: string
          reason?: string | null
          referral_id: string
          tokens_earned: number
          updated_at?: string | null
          user_id: string
        }
        Update: {
          claimed?: boolean | null
          created_at?: string | null
          id?: string
          reason?: string | null
          referral_id?: string
          tokens_earned?: number
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      remedial_actions: {
        Row: {
          created_at: string
          generated_at: string
          id: string
          questions: Json
          root_cause: string | null
          sow_id: string
          strand: string
          sub_strand: string
          substrand_health_id: string | null
          suggested_activity: string
          teacher_id: string
          updated_at: string
          week_of: string
        }
        Insert: {
          created_at?: string
          generated_at?: string
          id?: string
          questions?: Json
          root_cause?: string | null
          sow_id: string
          strand: string
          sub_strand: string
          substrand_health_id?: string | null
          suggested_activity: string
          teacher_id: string
          updated_at?: string
          week_of: string
        }
        Update: {
          created_at?: string
          generated_at?: string
          id?: string
          questions?: Json
          root_cause?: string | null
          sow_id?: string
          strand?: string
          sub_strand?: string
          substrand_health_id?: string | null
          suggested_activity?: string
          teacher_id?: string
          updated_at?: string
          week_of?: string
        }
        Relationships: [
          {
            foreignKeyName: "remedial_actions_sow_id_fkey"
            columns: ["sow_id"]
            isOneToOne: false
            referencedRelation: "schemes_of_work"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "remedial_actions_substrand_health_id_fkey"
            columns: ["substrand_health_id"]
            isOneToOne: false
            referencedRelation: "substrand_health"
            referencedColumns: ["id"]
          },
        ]
      }
      remedial_plans: {
        Row: {
          allocation: Json
          check_in_week: number | null
          class_id: string | null
          created_at: string | null
          generated_at: string | null
          groups: Json
          id: string
          sow_id: string
          strand: string
          sub_strand: string
          subject: string
          teacher_id: string
          term: number
          updated_at: string | null
          week_end: number
          week_start: number
          year: number
        }
        Insert: {
          allocation?: Json
          check_in_week?: number | null
          class_id?: string | null
          created_at?: string | null
          generated_at?: string | null
          groups?: Json
          id?: string
          sow_id: string
          strand: string
          sub_strand: string
          subject: string
          teacher_id: string
          term: number
          updated_at?: string | null
          week_end: number
          week_start: number
          year: number
        }
        Update: {
          allocation?: Json
          check_in_week?: number | null
          class_id?: string | null
          created_at?: string | null
          generated_at?: string | null
          groups?: Json
          id?: string
          sow_id?: string
          strand?: string
          sub_strand?: string
          subject?: string
          teacher_id?: string
          term?: number
          updated_at?: string | null
          week_end?: number
          week_start?: number
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "remedial_plans_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "teacher_classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "remedial_plans_sow_id_fkey"
            columns: ["sow_id"]
            isOneToOne: false
            referencedRelation: "schemes_of_work"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "remedial_plans_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "teachers"
            referencedColumns: ["id"]
          },
        ]
      }
      row_entries: {
        Row: {
          activities_summary: Json | null
          created_at: string | null
          date_taught: string | null
          id: string
          key_inquiry_questions: Json | null
          learning_outcomes: Json | null
          learning_resources: Json | null
          lesson: number
          reflection: string | null
          remarks: string | null
          row_id: string
          status: string | null
          strand: string | null
          substrand: string | null
          updated_at: string | null
          week: number
        }
        Insert: {
          activities_summary?: Json | null
          created_at?: string | null
          date_taught?: string | null
          id?: string
          key_inquiry_questions?: Json | null
          learning_outcomes?: Json | null
          learning_resources?: Json | null
          lesson?: number
          reflection?: string | null
          remarks?: string | null
          row_id: string
          status?: string | null
          strand?: string | null
          substrand?: string | null
          updated_at?: string | null
          week: number
        }
        Update: {
          activities_summary?: Json | null
          created_at?: string | null
          date_taught?: string | null
          id?: string
          key_inquiry_questions?: Json | null
          learning_outcomes?: Json | null
          learning_resources?: Json | null
          lesson?: number
          reflection?: string | null
          remarks?: string | null
          row_id?: string
          status?: string | null
          strand?: string | null
          substrand?: string | null
          updated_at?: string | null
          week?: number
        }
        Relationships: [
          {
            foreignKeyName: "row_entries_row_id_fkey"
            columns: ["row_id"]
            isOneToOne: false
            referencedRelation: "records_of_work"
            referencedColumns: ["id"]
          },
        ]
      }
      scheme_lessons: {
        Row: {
          assessment_methods: string
          core_competencies: string | null
          created_at: string | null
          id: string
          key_inquiry_questions: string
          learning_experiences: string
          learning_outcomes: string
          learning_resources: string
          lesson: number
          reflection: string | null
          scheme_id: string
          strand: string
          substrand: string
          updated_at: string | null
          values: string | null
          week: number
        }
        Insert: {
          assessment_methods: string
          core_competencies?: string | null
          created_at?: string | null
          id?: string
          key_inquiry_questions: string
          learning_experiences: string
          learning_outcomes: string
          learning_resources: string
          lesson: number
          reflection?: string | null
          scheme_id: string
          strand: string
          substrand: string
          updated_at?: string | null
          values?: string | null
          week: number
        }
        Update: {
          assessment_methods?: string
          core_competencies?: string | null
          created_at?: string | null
          id?: string
          key_inquiry_questions?: string
          learning_experiences?: string
          learning_outcomes?: string
          learning_resources?: string
          lesson?: number
          reflection?: string | null
          scheme_id?: string
          strand?: string
          substrand?: string
          updated_at?: string | null
          values?: string | null
          week?: number
        }
        Relationships: [
          {
            foreignKeyName: "scheme_lessons_scheme_id_fkey"
            columns: ["scheme_id"]
            isOneToOne: false
            referencedRelation: "schemes_of_work"
            referencedColumns: ["id"]
          },
        ]
      }
      schemes_of_work: {
        Row: {
          average_confidence: number | null
          breaks: Json | null
          created_at: string | null
          curriculum_mode: string
          grade: string
          id: string
          learning_area: string
          lessons: Json
          lessons_per_week: number
          school: string
          status: string | null
          teacher_id: string
          teacher_name: string | null
          term: number
          textbook: string | null
          timeline: Json
          total_lessons: number | null
          total_weeks: number | null
          tsc_number: string | null
          updated_at: string | null
          year: number
        }
        Insert: {
          average_confidence?: number | null
          breaks?: Json | null
          created_at?: string | null
          curriculum_mode: string
          grade: string
          id?: string
          learning_area: string
          lessons?: Json
          lessons_per_week: number
          school: string
          status?: string | null
          teacher_id: string
          teacher_name?: string | null
          term: number
          textbook?: string | null
          timeline?: Json
          total_lessons?: number | null
          total_weeks?: number | null
          tsc_number?: string | null
          updated_at?: string | null
          year: number
        }
        Update: {
          average_confidence?: number | null
          breaks?: Json | null
          created_at?: string | null
          curriculum_mode?: string
          grade?: string
          id?: string
          learning_area?: string
          lessons?: Json
          lessons_per_week?: number
          school?: string
          status?: string | null
          teacher_id?: string
          teacher_name?: string | null
          term?: number
          textbook?: string | null
          timeline?: Json
          total_lessons?: number | null
          total_weeks?: number | null
          tsc_number?: string | null
          updated_at?: string | null
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "schemes_of_work_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "teachers"
            referencedColumns: ["id"]
          },
        ]
      }
      school_intelligence_snapshots: {
        Row: {
          at_risk_count: number
          avg_capability_dimensions: Json | null
          created_at: string
          critical_count: number
          grade: number | null
          id: string
          interventions_effective: number
          interventions_run: number
          normal_count: number
          risk_trend: string | null
          school_id: string
          subject: string | null
          top_struggling_substrands: Json | null
          total_students: number
          watch_count: number
          week_of: string
        }
        Insert: {
          at_risk_count?: number
          avg_capability_dimensions?: Json | null
          created_at?: string
          critical_count?: number
          grade?: number | null
          id?: string
          interventions_effective?: number
          interventions_run?: number
          normal_count?: number
          risk_trend?: string | null
          school_id: string
          subject?: string | null
          top_struggling_substrands?: Json | null
          total_students?: number
          watch_count?: number
          week_of: string
        }
        Update: {
          at_risk_count?: number
          avg_capability_dimensions?: Json | null
          created_at?: string
          critical_count?: number
          grade?: number | null
          id?: string
          interventions_effective?: number
          interventions_run?: number
          normal_count?: number
          risk_trend?: string | null
          school_id?: string
          subject?: string | null
          top_struggling_substrands?: Json | null
          total_students?: number
          watch_count?: number
          week_of?: string
        }
        Relationships: []
      }
      school_report_cards: {
        Row: {
          class_id: string
          class_teacher_comment: string | null
          created_at: string
          days_absent: number | null
          days_present: number | null
          generated_at: string | null
          headteacher_comment: string | null
          id: string
          is_published: boolean
          learner_id: string
          overall_cbc_level: string | null
          overall_score: number | null
          pdf_url: string | null
          position_in_class: number | null
          published_at: string | null
          school_id: string
          term_id: string
          total_learners: number | null
          updated_at: string
        }
        Insert: {
          class_id: string
          class_teacher_comment?: string | null
          created_at?: string
          days_absent?: number | null
          days_present?: number | null
          generated_at?: string | null
          headteacher_comment?: string | null
          id?: string
          is_published?: boolean
          learner_id: string
          overall_cbc_level?: string | null
          overall_score?: number | null
          pdf_url?: string | null
          position_in_class?: number | null
          published_at?: string | null
          school_id: string
          term_id: string
          total_learners?: number | null
          updated_at?: string
        }
        Update: {
          class_id?: string
          class_teacher_comment?: string | null
          created_at?: string
          days_absent?: number | null
          days_present?: number | null
          generated_at?: string | null
          headteacher_comment?: string | null
          id?: string
          is_published?: boolean
          learner_id?: string
          overall_cbc_level?: string | null
          overall_score?: number | null
          pdf_url?: string | null
          position_in_class?: number | null
          published_at?: string | null
          school_id?: string
          term_id?: string
          total_learners?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "school_report_cards_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "school_report_cards_learner_id_fkey"
            columns: ["learner_id"]
            isOneToOne: false
            referencedRelation: "learners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "school_report_cards_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "school_report_cards_term_id_fkey"
            columns: ["term_id"]
            isOneToOne: false
            referencedRelation: "terms"
            referencedColumns: ["id"]
          },
        ]
      }
      school_settings: {
        Row: {
          cbc_levels: Json
          created_at: string
          curriculum_type: string
          grade_boundaries: Json
          id: string
          intelligence_enabled: boolean
          intelligence_enabled_at: string | null
          report_footer: string | null
          school_id: string
          school_open_days: number
          sms_enabled: boolean
          timezone: string
          updated_at: string
        }
        Insert: {
          cbc_levels?: Json
          created_at?: string
          curriculum_type?: string
          grade_boundaries?: Json
          id?: string
          intelligence_enabled?: boolean
          intelligence_enabled_at?: string | null
          report_footer?: string | null
          school_id: string
          school_open_days?: number
          sms_enabled?: boolean
          timezone?: string
          updated_at?: string
        }
        Update: {
          cbc_levels?: Json
          created_at?: string
          curriculum_type?: string
          grade_boundaries?: Json
          id?: string
          intelligence_enabled?: boolean
          intelligence_enabled_at?: string | null
          report_footer?: string | null
          school_id?: string
          school_open_days?: number
          sms_enabled?: boolean
          timezone?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "school_settings_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: true
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      school_teachers: {
        Row: {
          created_at: string | null
          id: string
          joined_at: string | null
          role: string | null
          school_id: string
          teacher_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          joined_at?: string | null
          role?: string | null
          school_id: string
          teacher_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          joined_at?: string | null
          role?: string | null
          school_id?: string
          teacher_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "school_teachers_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "school_teachers_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "teachers"
            referencedColumns: ["id"]
          },
        ]
      }
      school_users: {
        Row: {
          created_at: string
          id: string
          invited_by: string | null
          is_active: boolean
          joined_at: string | null
          role: string
          school_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          invited_by?: string | null
          is_active?: boolean
          joined_at?: string | null
          role: string
          school_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          invited_by?: string | null
          is_active?: boolean
          joined_at?: string | null
          role?: string
          school_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "school_users_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      schools: {
        Row: {
          address: string | null
          contact_email: string | null
          contact_phone: string | null
          county: string | null
          created_at: string | null
          created_by: string | null
          id: string
          is_active: boolean
          logo_url: string | null
          motto: string | null
          nemis_code: string | null
          school_name: string
          school_type: string | null
          sub_county: string | null
          subscription_tier: string | null
          updated_at: string | null
          ward: string | null
        }
        Insert: {
          address?: string | null
          contact_email?: string | null
          contact_phone?: string | null
          county?: string | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          is_active?: boolean
          logo_url?: string | null
          motto?: string | null
          nemis_code?: string | null
          school_name: string
          school_type?: string | null
          sub_county?: string | null
          subscription_tier?: string | null
          updated_at?: string | null
          ward?: string | null
        }
        Update: {
          address?: string | null
          contact_email?: string | null
          contact_phone?: string | null
          county?: string | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          is_active?: boolean
          logo_url?: string | null
          motto?: string | null
          nemis_code?: string | null
          school_name?: string
          school_type?: string | null
          sub_county?: string | null
          subscription_tier?: string | null
          updated_at?: string | null
          ward?: string | null
        }
        Relationships: []
      }
      shared_reports: {
        Row: {
          created_at: string
          expires_at: string
          grade: string
          id: string
          report_data: Json
          student_id: string
          student_name: string
          teacher_class_id: string | null
          token: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          expires_at: string
          grade: string
          id?: string
          report_data?: Json
          student_id: string
          student_name: string
          teacher_class_id?: string | null
          token: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          expires_at?: string
          grade?: string
          id?: string
          report_data?: Json
          student_id?: string
          student_name?: string
          teacher_class_id?: string | null
          token?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "shared_reports_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      slide_generations: {
        Row: {
          created_at: string
          grade: string
          id: string
          slides_count: number
          subject: string
          teacher_id: string
          topic: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          grade: string
          id?: string
          slides_count?: number
          subject: string
          teacher_id: string
          topic: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          grade?: string
          id?: string
          slides_count?: number
          subject?: string
          teacher_id?: string
          topic?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "slide_generations_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "teachers"
            referencedColumns: ["id"]
          },
        ]
      }
      sow_grades: {
        Row: {
          created_at: string | null
          id: string
          is_active: boolean | null
          level_id: string
          name: string
          numeric_grade: number | null
          order_index: number
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          level_id: string
          name: string
          numeric_grade?: number | null
          order_index: number
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          level_id?: string
          name?: string
          numeric_grade?: number | null
          order_index?: number
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sow_grades_level_id_fkey"
            columns: ["level_id"]
            isOneToOne: false
            referencedRelation: "sow_levels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sow_grades_level_id_fkey"
            columns: ["level_id"]
            isOneToOne: false
            referencedRelation: "v_api_subjects"
            referencedColumns: ["level_id"]
          },
        ]
      }
      sow_learning_areas: {
        Row: {
          created_at: string | null
          grade_id: string
          id: string
          kicd_subject_data: Json | null
          name: string
          order_index: number
          short_name: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          grade_id: string
          id?: string
          kicd_subject_data?: Json | null
          name: string
          order_index: number
          short_name?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          grade_id?: string
          id?: string
          kicd_subject_data?: Json | null
          name?: string
          order_index?: number
          short_name?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sow_learning_areas_grade_id_fkey"
            columns: ["grade_id"]
            isOneToOne: false
            referencedRelation: "sow_grades"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sow_learning_areas_grade_id_fkey"
            columns: ["grade_id"]
            isOneToOne: false
            referencedRelation: "v_api_subjects"
            referencedColumns: ["grade_id"]
          },
        ]
      }
      sow_learning_outcomes: {
        Row: {
          created_at: string | null
          id: string
          order_index: number | null
          outcome: string
          outcome_type: string | null
          substrand_id: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          order_index?: number | null
          outcome: string
          outcome_type?: string | null
          substrand_id?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          order_index?: number | null
          outcome?: string
          outcome_type?: string | null
          substrand_id?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      sow_levels: {
        Row: {
          created_at: string | null
          curriculum_type: string
          id: string
          name: string
          order_index: number
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          curriculum_type: string
          id?: string
          name: string
          order_index: number
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          curriculum_type?: string
          id?: string
          name?: string
          order_index?: number
          updated_at?: string | null
        }
        Relationships: []
      }
      sow_set_books: {
        Row: {
          book_author: string | null
          book_title: string
          created_at: string | null
          grade: string | null
          id: string
          learning_area_id: string | null
          updated_at: string | null
        }
        Insert: {
          book_author?: string | null
          book_title: string
          created_at?: string | null
          grade?: string | null
          id?: string
          learning_area_id?: string | null
          updated_at?: string | null
        }
        Update: {
          book_author?: string | null
          book_title?: string
          created_at?: string | null
          grade?: string | null
          id?: string
          learning_area_id?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      sow_strands: {
        Row: {
          created_at: string | null
          id: string
          kicd_data: Json | null
          learning_area_id: string
          order_index: number
          source_type: string | null
          title: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          kicd_data?: Json | null
          learning_area_id: string
          order_index: number
          source_type?: string | null
          title: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          kicd_data?: Json | null
          learning_area_id?: string
          order_index?: number
          source_type?: string | null
          title?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sow_strands_learning_area_id_fkey"
            columns: ["learning_area_id"]
            isOneToOne: false
            referencedRelation: "sow_learning_areas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sow_strands_learning_area_id_fkey"
            columns: ["learning_area_id"]
            isOneToOne: false
            referencedRelation: "v_api_learning_outcomes"
            referencedColumns: ["subject_id"]
          },
          {
            foreignKeyName: "sow_strands_learning_area_id_fkey"
            columns: ["learning_area_id"]
            isOneToOne: false
            referencedRelation: "v_api_strands"
            referencedColumns: ["subject_id"]
          },
          {
            foreignKeyName: "sow_strands_learning_area_id_fkey"
            columns: ["learning_area_id"]
            isOneToOne: false
            referencedRelation: "v_api_subjects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sow_strands_learning_area_id_fkey"
            columns: ["learning_area_id"]
            isOneToOne: false
            referencedRelation: "v_api_substrands"
            referencedColumns: ["subject_id"]
          },
        ]
      }
      sow_substrands: {
        Row: {
          content: Json | null
          created_at: string | null
          id: string
          order_index: number
          source_type: string | null
          strand_id: string
          suggested_lessons: number | null
          title: string
          updated_at: string | null
        }
        Insert: {
          content?: Json | null
          created_at?: string | null
          id?: string
          order_index: number
          source_type?: string | null
          strand_id: string
          suggested_lessons?: number | null
          title: string
          updated_at?: string | null
        }
        Update: {
          content?: Json | null
          created_at?: string | null
          id?: string
          order_index?: number
          source_type?: string | null
          strand_id?: string
          suggested_lessons?: number | null
          title?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sow_substrands_strand_id_fkey"
            columns: ["strand_id"]
            isOneToOne: false
            referencedRelation: "sow_strands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sow_substrands_strand_id_fkey"
            columns: ["strand_id"]
            isOneToOne: false
            referencedRelation: "v_api_learning_outcomes"
            referencedColumns: ["strand_id"]
          },
          {
            foreignKeyName: "sow_substrands_strand_id_fkey"
            columns: ["strand_id"]
            isOneToOne: false
            referencedRelation: "v_api_strands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sow_substrands_strand_id_fkey"
            columns: ["strand_id"]
            isOneToOne: false
            referencedRelation: "v_api_substrands"
            referencedColumns: ["strand_id"]
          },
        ]
      }
      sow_templates: {
        Row: {
          created_at: string | null
          curriculum_type: string | null
          description: string | null
          grade: string | null
          id: string
          name: string
          subject: string | null
          template_data: Json | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          curriculum_type?: string | null
          description?: string | null
          grade?: string | null
          id?: string
          name: string
          subject?: string | null
          template_data?: Json | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          curriculum_type?: string | null
          description?: string | null
          grade?: string | null
          id?: string
          name?: string
          subject?: string | null
          template_data?: Json | null
          updated_at?: string | null
        }
        Relationships: []
      }
      strand_assessments: {
        Row: {
          assessment_id: string | null
          class_id: string | null
          created_at: string
          id: string
          learner_notes: string | null
          marks: number | null
          rating: number
          source: string
          strand: string
          student_id: string
          subject: string
          teacher_id: string | null
          teacher_notes: string | null
          term: number | null
          topic: string
          total_marks: number | null
          updated_at: string
          year: number | null
        }
        Insert: {
          assessment_id?: string | null
          class_id?: string | null
          created_at?: string
          id?: string
          learner_notes?: string | null
          marks?: number | null
          rating: number
          source?: string
          strand: string
          student_id: string
          subject: string
          teacher_id?: string | null
          teacher_notes?: string | null
          term?: number | null
          topic: string
          total_marks?: number | null
          updated_at?: string
          year?: number | null
        }
        Update: {
          assessment_id?: string | null
          class_id?: string | null
          created_at?: string
          id?: string
          learner_notes?: string | null
          marks?: number | null
          rating?: number
          source?: string
          strand?: string
          student_id?: string
          subject?: string
          teacher_id?: string | null
          teacher_notes?: string | null
          term?: number | null
          topic?: string
          total_marks?: number | null
          updated_at?: string
          year?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "strand_assessments_assessment_id_fkey"
            columns: ["assessment_id"]
            isOneToOne: false
            referencedRelation: "assessments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "strand_assessments_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "teacher_classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "strand_assessments_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "strand_assessments_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "teachers"
            referencedColumns: ["id"]
          },
        ]
      }
      streams: {
        Row: {
          created_at: string
          id: string
          name: string
          school_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          school_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          school_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "streams_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      struggle_patterns: {
        Row: {
          created_at: string | null
          grade: number
          id: string
          score: number
          student_id: string
          subject: string
          term: number
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          grade: number
          id?: string
          score: number
          student_id: string
          subject: string
          term: number
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          grade?: number
          id?: string
          score?: number
          student_id?: string
          subject?: string
          term?: number
          updated_at?: string | null
        }
        Relationships: []
      }
      student_alerts: {
        Row: {
          alert_type: string
          created_at: string
          id: string
          is_resolved: boolean | null
          message: string
          student_id: string
          teacher_id: string
          updated_at: string | null
        }
        Insert: {
          alert_type: string
          created_at?: string
          id?: string
          is_resolved?: boolean | null
          message: string
          student_id: string
          teacher_id: string
          updated_at?: string | null
        }
        Update: {
          alert_type?: string
          created_at?: string
          id?: string
          is_resolved?: boolean | null
          message?: string
          student_id?: string
          teacher_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "student_alerts_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_alerts_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "teachers"
            referencedColumns: ["id"]
          },
        ]
      }
      student_career_interests: {
        Row: {
          career_id: string | null
          career_slug: string | null
          created_at: string | null
          explored_at: string | null
          id: string
          interest_level: number | null
          notes: string | null
          student_id: string
        }
        Insert: {
          career_id?: string | null
          career_slug?: string | null
          created_at?: string | null
          explored_at?: string | null
          id?: string
          interest_level?: number | null
          notes?: string | null
          student_id: string
        }
        Update: {
          career_id?: string | null
          career_slug?: string | null
          created_at?: string | null
          explored_at?: string | null
          id?: string
          interest_level?: number | null
          notes?: string | null
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "student_career_interests_career_id_fkey"
            columns: ["career_id"]
            isOneToOne: false
            referencedRelation: "careers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_career_interests_career_id_fkey"
            columns: ["career_id"]
            isOneToOne: false
            referencedRelation: "v_api_careers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_career_interests_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      student_career_matches: {
        Row: {
          career_id: string
          generated_at: string | null
          id: string
          match_reasoning: string | null
          match_score: number | null
          skill_gaps: Json | null
          student_id: string
          subject_gaps: Json | null
        }
        Insert: {
          career_id: string
          generated_at?: string | null
          id?: string
          match_reasoning?: string | null
          match_score?: number | null
          skill_gaps?: Json | null
          student_id: string
          subject_gaps?: Json | null
        }
        Update: {
          career_id?: string
          generated_at?: string | null
          id?: string
          match_reasoning?: string | null
          match_score?: number | null
          skill_gaps?: Json | null
          student_id?: string
          subject_gaps?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "student_career_matches_career_id_fkey"
            columns: ["career_id"]
            isOneToOne: false
            referencedRelation: "careers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_career_matches_career_id_fkey"
            columns: ["career_id"]
            isOneToOne: false
            referencedRelation: "v_api_careers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_career_matches_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      student_clinic_reports: {
        Row: {
          assessment_id: string | null
          class_id: string | null
          created_at: string | null
          email_sent_at: string | null
          id: string
          parent_opened_at: string | null
          pdf_url: string | null
          report_data: Json | null
          student_id: string | null
          teacher_id: string | null
          term: number | null
          whatsapp_sent_at: string | null
          year: number | null
        }
        Insert: {
          assessment_id?: string | null
          class_id?: string | null
          created_at?: string | null
          email_sent_at?: string | null
          id?: string
          parent_opened_at?: string | null
          pdf_url?: string | null
          report_data?: Json | null
          student_id?: string | null
          teacher_id?: string | null
          term?: number | null
          whatsapp_sent_at?: string | null
          year?: number | null
        }
        Update: {
          assessment_id?: string | null
          class_id?: string | null
          created_at?: string | null
          email_sent_at?: string | null
          id?: string
          parent_opened_at?: string | null
          pdf_url?: string | null
          report_data?: Json | null
          student_id?: string | null
          teacher_id?: string | null
          term?: number | null
          whatsapp_sent_at?: string | null
          year?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "student_clinic_reports_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "teacher_classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_clinic_reports_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_clinic_reports_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "teachers"
            referencedColumns: ["id"]
          },
        ]
      }
      student_guardians: {
        Row: {
          created_at: string | null
          guardian_id: string | null
          id: string
          relationship: string | null
          student_id: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          guardian_id?: string | null
          id?: string
          relationship?: string | null
          student_id?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          guardian_id?: string | null
          id?: string
          relationship?: string | null
          student_id?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      student_interests: {
        Row: {
          created_at: string
          id: string
          interests: Json
          student_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          interests?: Json
          student_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          interests?: Json
          student_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "student_interests_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: true
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      student_invites: {
        Row: {
          created_at: string
          email_opened_at: string | null
          expires_at: string
          id: string
          parent_email: string | null
          student_id: string
          token: string
          used_at: string | null
        }
        Insert: {
          created_at?: string
          email_opened_at?: string | null
          expires_at?: string
          id?: string
          parent_email?: string | null
          student_id: string
          token?: string
          used_at?: string | null
        }
        Update: {
          created_at?: string
          email_opened_at?: string | null
          expires_at?: string
          id?: string
          parent_email?: string | null
          student_id?: string
          token?: string
          used_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "student_invites_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      student_learning_context: {
        Row: {
          career_gaps: Json | null
          compass_bridge: Json | null
          curriculum_type: string | null
          first_subject: string | null
          grade: number | null
          guided_topics: Json | null
          knowledge_graph_computed_at: string | null
          knowledge_root_causes: Json | null
          last_assessment_id: string | null
          overall_level: number | null
          overall_tier: string | null
          pathway_confidence: string | null
          pathway_scores: Json | null
          recommended_pathway: string | null
          session_goal: string | null
          sessions_this_week: number | null
          sessions_without_improvement: number
          student_id: string
          subject_action_steps: Json | null
          subject_rest_until: string | null
          subject_tiers: Json | null
          subject_velocities: Json | null
          top_careers: Json | null
          total_sessions: number | null
          updated_at: string | null
          user_id: string | null
          week_start_date: string | null
        }
        Insert: {
          career_gaps?: Json | null
          compass_bridge?: Json | null
          curriculum_type?: string | null
          first_subject?: string | null
          grade?: number | null
          guided_topics?: Json | null
          knowledge_graph_computed_at?: string | null
          knowledge_root_causes?: Json | null
          last_assessment_id?: string | null
          overall_level?: number | null
          overall_tier?: string | null
          pathway_confidence?: string | null
          pathway_scores?: Json | null
          recommended_pathway?: string | null
          session_goal?: string | null
          sessions_this_week?: number | null
          sessions_without_improvement?: number
          student_id: string
          subject_action_steps?: Json | null
          subject_rest_until?: string | null
          subject_tiers?: Json | null
          subject_velocities?: Json | null
          top_careers?: Json | null
          total_sessions?: number | null
          updated_at?: string | null
          user_id?: string | null
          week_start_date?: string | null
        }
        Update: {
          career_gaps?: Json | null
          compass_bridge?: Json | null
          curriculum_type?: string | null
          first_subject?: string | null
          grade?: number | null
          guided_topics?: Json | null
          knowledge_graph_computed_at?: string | null
          knowledge_root_causes?: Json | null
          last_assessment_id?: string | null
          overall_level?: number | null
          overall_tier?: string | null
          pathway_confidence?: string | null
          pathway_scores?: Json | null
          recommended_pathway?: string | null
          session_goal?: string | null
          sessions_this_week?: number | null
          sessions_without_improvement?: number
          student_id?: string
          subject_action_steps?: Json | null
          subject_rest_until?: string | null
          subject_tiers?: Json | null
          subject_velocities?: Json | null
          top_careers?: Json | null
          total_sessions?: number | null
          updated_at?: string | null
          user_id?: string | null
          week_start_date?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "student_learning_context_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: true
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      students: {
        Row: {
          added_by: string
          capability_computed_at: string | null
          capability_profile: Json | null
          created_at: string
          current_pathway: string | null
          curriculum_type: string
          date_of_birth: string | null
          external_id: string | null
          financial_tier: string | null
          grade: number
          id: string
          integration_connection_id: string | null
          is_beta_tester: boolean
          level: string
          location_preference: Json | null
          name: string
          notification_email: boolean | null
          notification_whatsapp: boolean
          parent_email: string | null
          parent_first_name: string | null
          parent_phone: string | null
          parent_user_id: string | null
          school: string | null
          selected_subjects: string[] | null
          teacher_id: string | null
          term: number | null
          updated_at: string | null
          user_id: string | null
          whatsapp_opted_in: boolean | null
          whatsapp_opted_in_at: string | null
          year: number | null
          year_level: string | null
        }
        Insert: {
          added_by?: string
          capability_computed_at?: string | null
          capability_profile?: Json | null
          created_at?: string
          current_pathway?: string | null
          curriculum_type?: string
          date_of_birth?: string | null
          external_id?: string | null
          financial_tier?: string | null
          grade: number
          id?: string
          integration_connection_id?: string | null
          is_beta_tester?: boolean
          level: string
          location_preference?: Json | null
          name: string
          notification_email?: boolean | null
          notification_whatsapp?: boolean
          parent_email?: string | null
          parent_first_name?: string | null
          parent_phone?: string | null
          parent_user_id?: string | null
          school?: string | null
          selected_subjects?: string[] | null
          teacher_id?: string | null
          term?: number | null
          updated_at?: string | null
          user_id?: string | null
          whatsapp_opted_in?: boolean | null
          whatsapp_opted_in_at?: string | null
          year?: number | null
          year_level?: string | null
        }
        Update: {
          added_by?: string
          capability_computed_at?: string | null
          capability_profile?: Json | null
          created_at?: string
          current_pathway?: string | null
          curriculum_type?: string
          date_of_birth?: string | null
          external_id?: string | null
          financial_tier?: string | null
          grade?: number
          id?: string
          integration_connection_id?: string | null
          is_beta_tester?: boolean
          level?: string
          location_preference?: Json | null
          name?: string
          notification_email?: boolean | null
          notification_whatsapp?: boolean
          parent_email?: string | null
          parent_first_name?: string | null
          parent_phone?: string | null
          parent_user_id?: string | null
          school?: string | null
          selected_subjects?: string[] | null
          teacher_id?: string | null
          term?: number | null
          updated_at?: string | null
          user_id?: string | null
          whatsapp_opted_in?: boolean | null
          whatsapp_opted_in_at?: string | null
          year?: number | null
          year_level?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "students_integration_connection_id_fkey"
            columns: ["integration_connection_id"]
            isOneToOne: false
            referencedRelation: "integration_connections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "students_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "teachers"
            referencedColumns: ["id"]
          },
        ]
      }
      study_group_answers: {
        Row: {
          answer: string
          challenge_id: string
          created_at: string
          group_id: string
          id: string
          is_anonymous: boolean
          is_correct: boolean
          points_earned: number
          student_name: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          answer: string
          challenge_id: string
          created_at?: string
          group_id: string
          id?: string
          is_anonymous?: boolean
          is_correct?: boolean
          points_earned?: number
          student_name: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          answer?: string
          challenge_id?: string
          created_at?: string
          group_id?: string
          id?: string
          is_anonymous?: boolean
          is_correct?: boolean
          points_earned?: number
          student_name?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "study_group_answers_challenge_id_fkey"
            columns: ["challenge_id"]
            isOneToOne: false
            referencedRelation: "study_group_challenges"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "study_group_answers_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "study_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      study_group_challenges: {
        Row: {
          correct_answer: string
          created_at: string
          date: string
          difficulty: number | null
          explanation: string | null
          group_id: string
          hint: string | null
          id: string
          kenyan_context: string | null
          options: Json | null
          question: string
          subject: string | null
          updated_at: string | null
        }
        Insert: {
          correct_answer: string
          created_at?: string
          date: string
          difficulty?: number | null
          explanation?: string | null
          group_id: string
          hint?: string | null
          id?: string
          kenyan_context?: string | null
          options?: Json | null
          question: string
          subject?: string | null
          updated_at?: string | null
        }
        Update: {
          correct_answer?: string
          created_at?: string
          date?: string
          difficulty?: number | null
          explanation?: string | null
          group_id?: string
          hint?: string | null
          id?: string
          kenyan_context?: string | null
          options?: Json | null
          question?: string
          subject?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "study_group_challenges_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "study_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      study_group_members: {
        Row: {
          created_at: string | null
          group_id: string
          id: string
          joined_at: string
          points: number
          student_id: string | null
          student_name: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          group_id: string
          id?: string
          joined_at?: string
          points?: number
          student_id?: string | null
          student_name: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          group_id?: string
          id?: string
          joined_at?: string
          points?: number
          student_id?: string | null
          student_name?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "study_group_members_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "study_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "study_group_members_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      study_groups: {
        Row: {
          created_at: string
          created_by: string
          grade: number
          ground_rules: string[] | null
          id: string
          invite_code: string
          max_members: number
          name: string
          status: string
          subject: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string
          created_by: string
          grade: number
          ground_rules?: string[] | null
          id?: string
          invite_code: string
          max_members?: number
          name: string
          status?: string
          subject: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string
          grade?: number
          ground_rules?: string[] | null
          id?: string
          invite_code?: string
          max_members?: number
          name?: string
          status?: string
          subject?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      subjects: {
        Row: {
          category: string
          code: string
          created_at: string
          id: string
          is_core: boolean
          name: string
          updated_at: string
        }
        Insert: {
          category: string
          code: string
          created_at?: string
          id?: string
          is_core?: boolean
          name: string
          updated_at?: string
        }
        Update: {
          category?: string
          code?: string
          created_at?: string
          id?: string
          is_core?: boolean
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      subscriptions: {
        Row: {
          amount_paid: number | null
          billing_cycle: string | null
          created_at: string
          end_date: string | null
          expires_at: string
          id: string
          payment_id: string | null
          plan: string
          plan_type: string | null
          started_at: string
          status: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          amount_paid?: number | null
          billing_cycle?: string | null
          created_at?: string
          end_date?: string | null
          expires_at: string
          id?: string
          payment_id?: string | null
          plan: string
          plan_type?: string | null
          started_at?: string
          status?: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          amount_paid?: number | null
          billing_cycle?: string | null
          created_at?: string
          end_date?: string | null
          expires_at?: string
          id?: string
          payment_id?: string | null
          plan?: string
          plan_type?: string | null
          started_at?: string
          status?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscriptions_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "payments"
            referencedColumns: ["id"]
          },
        ]
      }
      substrand_health: {
        Row: {
          assessment_level: number | null
          class_id: string | null
          created_at: string
          id: string
          last_flagged: string | null
          lessons_covered: number
          remediated: boolean
          resolved_at: string | null
          risk_score: number | null
          root_cause: string | null
          sow_id: string
          strand: string
          struggle_count: number
          sub_strand: string
          teacher_id: string
          updated_at: string
        }
        Insert: {
          assessment_level?: number | null
          class_id?: string | null
          created_at?: string
          id?: string
          last_flagged?: string | null
          lessons_covered?: number
          remediated?: boolean
          resolved_at?: string | null
          risk_score?: number | null
          root_cause?: string | null
          sow_id: string
          strand: string
          struggle_count?: number
          sub_strand: string
          teacher_id: string
          updated_at?: string
        }
        Update: {
          assessment_level?: number | null
          class_id?: string | null
          created_at?: string
          id?: string
          last_flagged?: string | null
          lessons_covered?: number
          remediated?: boolean
          resolved_at?: string | null
          risk_score?: number | null
          root_cause?: string | null
          sow_id?: string
          strand?: string
          struggle_count?: number
          sub_strand?: string
          teacher_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "substrand_health_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "teacher_classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "substrand_health_sow_id_fkey"
            columns: ["sow_id"]
            isOneToOne: false
            referencedRelation: "schemes_of_work"
            referencedColumns: ["id"]
          },
        ]
      }
      teacher_classes: {
        Row: {
          academic_year: string
          class_code: string
          created_at: string
          curriculum_level: string | null
          external_id: string | null
          grade: number
          grade_cohort: string | null
          id: string
          integration_connection_id: string | null
          name: string
          selected_subjects: string[] | null
          stream: string | null
          subject: string
          teacher_id: string
          teaching_subject: string | null
          updated_at: string | null
        }
        Insert: {
          academic_year?: string
          class_code: string
          created_at?: string
          curriculum_level?: string | null
          external_id?: string | null
          grade: number
          grade_cohort?: string | null
          id?: string
          integration_connection_id?: string | null
          name: string
          selected_subjects?: string[] | null
          stream?: string | null
          subject: string
          teacher_id: string
          teaching_subject?: string | null
          updated_at?: string | null
        }
        Update: {
          academic_year?: string
          class_code?: string
          created_at?: string
          curriculum_level?: string | null
          external_id?: string | null
          grade?: number
          grade_cohort?: string | null
          id?: string
          integration_connection_id?: string | null
          name?: string
          selected_subjects?: string[] | null
          stream?: string | null
          subject?: string
          teacher_id?: string
          teaching_subject?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "teacher_classes_integration_connection_id_fkey"
            columns: ["integration_connection_id"]
            isOneToOne: false
            referencedRelation: "integration_connections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "teacher_classes_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "teachers"
            referencedColumns: ["id"]
          },
        ]
      }
      teacher_grade_scales: {
        Row: {
          bands: Json
          created_at: string
          curriculum_hint: string
          id: string
          is_default: boolean
          name: string
          teacher_id: string | null
          updated_at: string
        }
        Insert: {
          bands?: Json
          created_at?: string
          curriculum_hint?: string
          id?: string
          is_default?: boolean
          name: string
          teacher_id?: string | null
          updated_at?: string
        }
        Update: {
          bands?: Json
          created_at?: string
          curriculum_hint?: string
          id?: string
          is_default?: boolean
          name?: string
          teacher_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "teacher_grade_scales_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "teachers"
            referencedColumns: ["id"]
          },
        ]
      }
      teachers: {
        Row: {
          created_at: string
          full_name: string
          grade_levels: number[] | null
          id: string
          is_verified: boolean | null
          phone: string | null
          pioneer_number: number | null
          role: string
          school: string
          subject: string | null
          tsc_number: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          full_name: string
          grade_levels?: number[] | null
          id?: string
          is_verified?: boolean | null
          phone?: string | null
          pioneer_number?: number | null
          role?: string
          school: string
          subject?: string | null
          tsc_number?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          full_name?: string
          grade_levels?: number[] | null
          id?: string
          is_verified?: boolean | null
          phone?: string | null
          pioneer_number?: number | null
          role?: string
          school?: string
          subject?: string | null
          tsc_number?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      term_subject_summaries: {
        Row: {
          cbc_level: string | null
          class_id: string
          computed_at: string
          created_at: string
          id: string
          learner_id: string
          position_in_class: number | null
          school_id: string
          subject_id: string
          teacher_comment: string | null
          term_id: string
          updated_at: string
          weighted_score: number | null
        }
        Insert: {
          cbc_level?: string | null
          class_id: string
          computed_at?: string
          created_at?: string
          id?: string
          learner_id: string
          position_in_class?: number | null
          school_id: string
          subject_id: string
          teacher_comment?: string | null
          term_id: string
          updated_at?: string
          weighted_score?: number | null
        }
        Update: {
          cbc_level?: string | null
          class_id?: string
          computed_at?: string
          created_at?: string
          id?: string
          learner_id?: string
          position_in_class?: number | null
          school_id?: string
          subject_id?: string
          teacher_comment?: string | null
          term_id?: string
          updated_at?: string
          weighted_score?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "term_subject_summaries_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "term_subject_summaries_learner_id_fkey"
            columns: ["learner_id"]
            isOneToOne: false
            referencedRelation: "learners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "term_subject_summaries_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "term_subject_summaries_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "term_subject_summaries_term_id_fkey"
            columns: ["term_id"]
            isOneToOne: false
            referencedRelation: "terms"
            referencedColumns: ["id"]
          },
        ]
      }
      terms: {
        Row: {
          academic_year_id: string
          created_at: string
          end_date: string
          id: string
          is_current: boolean
          name: string
          school_id: string
          start_date: string
          term_number: number
          updated_at: string
        }
        Insert: {
          academic_year_id: string
          created_at?: string
          end_date: string
          id?: string
          is_current?: boolean
          name: string
          school_id: string
          start_date: string
          term_number: number
          updated_at?: string
        }
        Update: {
          academic_year_id?: string
          created_at?: string
          end_date?: string
          id?: string
          is_current?: boolean
          name?: string
          school_id?: string
          start_date?: string
          term_number?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "terms_academic_year_id_fkey"
            columns: ["academic_year_id"]
            isOneToOne: false
            referencedRelation: "academic_years"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "terms_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      token_balances: {
        Row: {
          balance: number
          created_at: string | null
          id: string
          total_ever: number
          updated_at: string
          user_id: string
        }
        Insert: {
          balance?: number
          created_at?: string | null
          id?: string
          total_ever?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          balance?: number
          created_at?: string | null
          id?: string
          total_ever?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      token_usage: {
        Row: {
          action: string
          created_at: string
          id: string
          metadata: Json | null
          tokens_used: number
          user_id: string
        }
        Insert: {
          action: string
          created_at?: string
          id?: string
          metadata?: Json | null
          tokens_used: number
          user_id: string
        }
        Update: {
          action?: string
          created_at?: string
          id?: string
          metadata?: Json | null
          tokens_used?: number
          user_id?: string
        }
        Relationships: []
      }
      user_activity_log: {
        Row: {
          activity_type: string
          created_at: string
          id: string
          metadata: Json | null
          user_id: string
        }
        Insert: {
          activity_type: string
          created_at?: string
          id?: string
          metadata?: Json | null
          user_id: string
        }
        Update: {
          activity_type?: string
          created_at?: string
          id?: string
          metadata?: Json | null
          user_id?: string
        }
        Relationships: []
      }
      user_cleanup_stats: {
        Row: {
          created_at: string | null
          deleted_count: number
          details: Json | null
          id: string
          idle_deleted: number
          run_at: string
          unverified_deleted: number
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          deleted_count?: number
          details?: Json | null
          id?: string
          idle_deleted?: number
          run_at?: string
          unverified_deleted?: number
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          deleted_count?: number
          details?: Json | null
          id?: string
          idle_deleted?: number
          run_at?: string
          unverified_deleted?: number
          updated_at?: string | null
        }
        Relationships: []
      }
      user_feedback: {
        Row: {
          category: string | null
          created_at: string
          id: string
          message: string | null
          nps_score: number | null
          rating: string | null
          trigger: string | null
          updated_at: string | null
          user_id: string
          would_recommend: boolean | null
        }
        Insert: {
          category?: string | null
          created_at?: string
          id?: string
          message?: string | null
          nps_score?: number | null
          rating?: string | null
          trigger?: string | null
          updated_at?: string | null
          user_id: string
          would_recommend?: boolean | null
        }
        Update: {
          category?: string | null
          created_at?: string
          id?: string
          message?: string | null
          nps_score?: number | null
          rating?: string | null
          trigger?: string | null
          updated_at?: string | null
          user_id?: string
          would_recommend?: boolean | null
        }
        Relationships: []
      }
      user_tokens: {
        Row: {
          created_at: string
          expiry_date: string | null
          id: string
          purchase_date: string
          tokens_purchased: number
          tokens_remaining: number
          tokens_used: number
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          expiry_date?: string | null
          id?: string
          purchase_date?: string
          tokens_purchased?: number
          tokens_remaining?: number
          tokens_used?: number
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          expiry_date?: string | null
          id?: string
          purchase_date?: string
          tokens_purchased?: number
          tokens_remaining?: number
          tokens_used?: number
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      users: {
        Row: {
          created_at: string
          email: string
          free_analyses: number
          free_analyses_expire_at: string | null
          free_analyses_used: number
          full_name: string | null
          has_seen_onboarding: boolean
          id: string
          is_marked_for_deletion: boolean
          last_active: string | null
          marked_for_deletion_at: string | null
          onboarding_completed_at: string | null
          referral_code: string | null
          referred_by_code: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string
          email: string
          free_analyses?: number
          free_analyses_expire_at?: string | null
          free_analyses_used?: number
          full_name?: string | null
          has_seen_onboarding?: boolean
          id: string
          is_marked_for_deletion?: boolean
          last_active?: string | null
          marked_for_deletion_at?: string | null
          onboarding_completed_at?: string | null
          referral_code?: string | null
          referred_by_code?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          free_analyses?: number
          free_analyses_expire_at?: string | null
          free_analyses_used?: number
          full_name?: string | null
          has_seen_onboarding?: boolean
          id?: string
          is_marked_for_deletion?: boolean
          last_active?: string | null
          marked_for_deletion_at?: string | null
          onboarding_completed_at?: string | null
          referral_code?: string | null
          referred_by_code?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      webhook_errors: {
        Row: {
          created_at: string
          error_message: string | null
          event_type: string | null
          id: string
          payload: Json | null
          reference: string | null
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          event_type?: string | null
          id?: string
          payload?: Json | null
          reference?: string | null
        }
        Update: {
          created_at?: string
          error_message?: string | null
          event_type?: string | null
          id?: string
          payload?: Json | null
          reference?: string | null
        }
        Relationships: []
      }
      weekly_intelligence: {
        Row: {
          created_at: string
          id: string
          lessons_analyzed: number
          new_flags: Json
          persistent_flags: Json
          remedial_bank_items: Json
          resolved_flags: Json
          sow_id: string
          teacher_id: string
          teacher_note: string | null
          week_health_score: number | null
          week_number: number
        }
        Insert: {
          created_at?: string
          id?: string
          lessons_analyzed?: number
          new_flags?: Json
          persistent_flags?: Json
          remedial_bank_items?: Json
          resolved_flags?: Json
          sow_id: string
          teacher_id: string
          teacher_note?: string | null
          week_health_score?: number | null
          week_number: number
        }
        Update: {
          created_at?: string
          id?: string
          lessons_analyzed?: number
          new_flags?: Json
          persistent_flags?: Json
          remedial_bank_items?: Json
          resolved_flags?: Json
          sow_id?: string
          teacher_id?: string
          teacher_note?: string | null
          week_health_score?: number | null
          week_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "weekly_intelligence_sow_id_fkey"
            columns: ["sow_id"]
            isOneToOne: false
            referencedRelation: "schemes_of_work"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_inbound_log: {
        Row: {
          created_at: string
          error_message: string | null
          id: string
          parent_id: string | null
          parsed_reply: string | null
          phone: string
          processed: boolean
          pulse_week_of: string | null
          raw_body: string
          received_at: string
          student_id: string | null
          substrand_context: string | null
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          id?: string
          parent_id?: string | null
          parsed_reply?: string | null
          phone: string
          processed?: boolean
          pulse_week_of?: string | null
          raw_body: string
          received_at?: string
          student_id?: string | null
          substrand_context?: string | null
        }
        Update: {
          created_at?: string
          error_message?: string | null
          id?: string
          parent_id?: string | null
          parsed_reply?: string | null
          phone?: string
          processed?: boolean
          pulse_week_of?: string | null
          raw_body?: string
          received_at?: string
          student_id?: string | null
          substrand_context?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_inbound_log_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_opt_ins: {
        Row: {
          created_at: string | null
          id: string
          opted_in_at: string | null
          opted_out_at: string | null
          parent_phone: string
          source: string | null
          student_id: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          opted_in_at?: string | null
          opted_out_at?: string | null
          parent_phone: string
          source?: string | null
          student_id?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          opted_in_at?: string | null
          opted_out_at?: string | null
          parent_phone?: string
          source?: string | null
          student_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_opt_ins_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      v_api_careers: {
        Row: {
          ai_impact_creating: Json | null
          ai_impact_level: string | null
          ai_impact_replacing: Json | null
          ai_impact_summary: string | null
          alternative_career_slugs: string[] | null
          category: string | null
          complementary_career_slugs: string[] | null
          cost_to_qualify: Json | null
          difficulty: string | null
          doors: Json | null
          future_skills: Json | null
          id: string | null
          kcse_minimum: Json | null
          kenya_demand: string | null
          kenya_examples: Json | null
          kenya_market_outlook: string | null
          pathway: string | null
          prestige_level: number | null
          required_subjects: Json | null
          risk_level: string | null
          salary_range_kes: Json | null
          saturation_note: string | null
          skill_timeline: Json | null
          slug: string | null
          social_reality: Json | null
          time_to_income_years: number | null
          title: string | null
          updated_at: string | null
        }
        Insert: {
          ai_impact_creating?: never
          ai_impact_level?: never
          ai_impact_replacing?: never
          ai_impact_summary?: never
          alternative_career_slugs?: string[] | null
          category?: string | null
          complementary_career_slugs?: string[] | null
          cost_to_qualify?: Json | null
          difficulty?: string | null
          doors?: Json | null
          future_skills?: Json | null
          id?: string | null
          kcse_minimum?: Json | null
          kenya_demand?: string | null
          kenya_examples?: Json | null
          kenya_market_outlook?: string | null
          pathway?: string | null
          prestige_level?: number | null
          required_subjects?: Json | null
          risk_level?: string | null
          salary_range_kes?: Json | null
          saturation_note?: string | null
          skill_timeline?: Json | null
          slug?: string | null
          social_reality?: Json | null
          time_to_income_years?: number | null
          title?: string | null
          updated_at?: string | null
        }
        Update: {
          ai_impact_creating?: never
          ai_impact_level?: never
          ai_impact_replacing?: never
          ai_impact_summary?: never
          alternative_career_slugs?: string[] | null
          category?: string | null
          complementary_career_slugs?: string[] | null
          cost_to_qualify?: Json | null
          difficulty?: string | null
          doors?: Json | null
          future_skills?: Json | null
          id?: string | null
          kcse_minimum?: Json | null
          kenya_demand?: string | null
          kenya_examples?: Json | null
          kenya_market_outlook?: string | null
          pathway?: string | null
          prestige_level?: number | null
          required_subjects?: Json | null
          risk_level?: string | null
          salary_range_kes?: Json | null
          saturation_note?: string | null
          skill_timeline?: Json | null
          slug?: string | null
          social_reality?: Json | null
          time_to_income_years?: number | null
          title?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      v_api_learning_outcomes: {
        Row: {
          curriculum: string | null
          grade: string | null
          id: string | null
          level: string | null
          numeric_grade: number | null
          order_index: number | null
          outcome: string | null
          outcome_type: string | null
          strand_id: string | null
          strand_title: string | null
          subject: string | null
          subject_id: string | null
          substrand_id: string | null
          substrand_title: string | null
        }
        Relationships: []
      }
      v_api_strands: {
        Row: {
          curriculum: string | null
          grade: string | null
          grade_order: number | null
          id: string | null
          level: string | null
          level_order: number | null
          numeric_grade: number | null
          order_index: number | null
          subject: string | null
          subject_id: string | null
          subject_short: string | null
          title: string | null
        }
        Relationships: []
      }
      v_api_subjects: {
        Row: {
          curriculum: string | null
          grade: string | null
          grade_id: string | null
          grade_order: number | null
          id: string | null
          level: string | null
          level_id: string | null
          level_order: number | null
          name: string | null
          numeric_grade: number | null
          short_name: string | null
          subject_order: number | null
        }
        Relationships: []
      }
      v_api_substrands: {
        Row: {
          curriculum: string | null
          grade: string | null
          grade_order: number | null
          id: string | null
          level: string | null
          level_order: number | null
          numeric_grade: number | null
          order_index: number | null
          strand_id: string | null
          strand_title: string | null
          subject: string | null
          subject_id: string | null
          subject_short: string | null
          suggested_lessons: number | null
          title: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      add_ai_tokens: {
        Args: { p_tokens: number; p_user_id: string }
        Returns: undefined
      }
      add_tokens: {
        Args: { p_tokens: number; p_user_id: string }
        Returns: undefined
      }
      auth_is_guardian_of: { Args: { p_student_id: string }; Returns: boolean }
      auth_is_teacher_of_student: {
        Args: { p_student_id: string }
        Returns: boolean
      }
      auth_owns_student: { Args: { p_student_id: string }; Returns: boolean }
      auth_teacher_id: { Args: never; Returns: string }
      can_add_student_to_school: {
        Args: { p_school_id: string }
        Returns: boolean
      }
      check_and_expire_subscriptions: { Args: never; Returns: number }
      check_subscription_active: {
        Args: { p_user_id: string }
        Returns: boolean
      }
      cleanup_marked_users: {
        Args: never
        Returns: {
          deleted_count: number
          idle_deleted: number
          unverified_deleted: number
        }[]
      }
      cleanup_old_ai_usage: { Args: never; Returns: undefined }
      create_free_subscription: { Args: { p_user_id: string }; Returns: string }
      create_user_with_referral: {
        Args: { p_email: string; p_name?: string; p_referred_by_code?: string }
        Returns: {
          free_analyses: number
          referral_code: string
          user_id: string
        }[]
      }
      deduct_ai_token:
        | { Args: { p_feature: string; p_user_id: string }; Returns: boolean }
        | { Args: { p_feature: string; p_user_id: string }; Returns: boolean }
      deduct_tokens:
        | {
            Args: {
              p_action: string
              p_metadata?: Json
              p_tokens: number
              p_user_id: string
            }
            Returns: boolean
          }
        | { Args: { p_tokens: number; p_user_id: string }; Returns: boolean }
      devportal_record_request: {
        Args: {
          p_api_key_id: string
          p_developer_id: string
          p_ip_address?: string
          p_latency_ms?: number
          p_method: string
          p_path: string
          p_status_code: number
          p_tokens_used?: number
          p_user_agent?: string
        }
        Returns: undefined
      }
      expire_free_analyses: { Args: never; Returns: undefined }
      get_active_subscription: {
        Args: { p_user_id: string }
        Returns: {
          ai_tokens_remaining: number
          expires_at: string
          id: string
          plan_type: string
        }[]
      }
      get_grade_topics: {
        Args: { p_grade: number; p_min_grade: number; p_subject: string }
        Returns: {
          title: string
        }[]
      }
      get_learner_dashboard_stats: {
        Args: { p_learner_id: string }
        Returns: {
          avg_cognitive_load: string
          concepts_mastered: number
          last_session_quality: number
          streak_days: number
        }[]
      }
      get_referral_stats: {
        Args: { p_user_id: string }
        Returns: {
          completed_referrals: number
          pending_referrals: number
          recent_referrals: Json
          referral_code: string
          total_referrals: number
          total_tokens_earned: number
        }[]
      }
      get_school_student_count: {
        Args: { p_school_id: string }
        Returns: number
      }
      get_struggle_history: {
        Args: { p_student_id: string }
        Returns: {
          grade: number
          score: number
          struggling: boolean
          subject: string
          term: number
          year: number
        }[]
      }
      handle_successful_payment_webhook: {
        Args: {
          p_amount: number
          p_customer_email: string
          p_metadata: Json
          p_payment_type: string
          p_product_id: string
          p_tokens_to_add: number
          p_transaction_id: string
          p_user_id: string
        }
        Returns: undefined
      }
      increment_beta_teacher_count: { Args: never; Returns: number }
      increment_insights_view: {
        Args: { article_slug: string }
        Returns: undefined
      }
      is_admin: { Args: never; Returns: boolean }
      mark_users_for_deletion: { Args: never; Returns: undefined }
      restore_user: { Args: { p_email: string }; Returns: boolean }
      show_limit: { Args: never; Returns: number }
      show_trgm: { Args: { "": string }; Returns: string[] }
      track_career_request: {
        Args: { career_name_param: string }
        Returns: undefined
      }
      upgrade_subscription: {
        Args: {
          p_plan_type: string
          p_term_number?: number
          p_term_year?: number
          p_user_id: string
        }
        Returns: string
      }
      upgrade_to_termly: { Args: { p_user_id: string }; Returns: undefined }
      use_free_analysis: { Args: { p_user_id: string }; Returns: boolean }
    }
    Enums: {
      payment_status: "pending" | "success" | "failed" | "cancelled"
      plan_type: "starter" | "term" | "premium"
      subscription_status: "active" | "expired" | "cancelled"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      payment_status: ["pending", "success", "failed", "cancelled"],
      plan_type: ["starter", "term", "premium"],
      subscription_status: ["active", "expired", "cancelled"],
    },
  },
} as const
