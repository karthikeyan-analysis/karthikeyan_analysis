/**
 * Customizable registration/application form config for a "Test Batch"
 * (Batch.kind === "test"). Stored as its own doc, separate from the
 * course-enrollment system's BatchEnrollmentConfig, so customizing a test
 * batch's form can never affect course-batch enrollment forms.
 */
export interface TestBatchFormConfig {
  /** Same as the doc id (== Batch.id), 1:1 with a batch. */
  batchId: string;
  header: {
    batchName: string;
    courseSubjectName: string;
    duration: string;
  };
  footer: {
    instructions: string;
    termsAndConditions: string;
  };
  /** false = no doc has been saved yet; the form renders system defaults. */
  isCustomized: boolean;
  updatedAt: string; // ISO
  updatedBy: string; // admin uid
}

export type TestBatchFormConfigInput = Pick<TestBatchFormConfig, "header" | "footer">;
