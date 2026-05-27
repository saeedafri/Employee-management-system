-- Add documentUrl to Payslip for Cloudinary payslip PDF/image links
ALTER TABLE "Payslip" ADD COLUMN IF NOT EXISTS "documentUrl" TEXT;
