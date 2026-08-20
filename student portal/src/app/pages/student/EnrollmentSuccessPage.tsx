import React from "react";
import { useNavigate } from "react-router";
import { Button } from "../../components/ui/button";
import { Card, CardContent } from "../../components/ui/card";
import { CheckCircle2 } from "lucide-react";

export default function EnrollmentSuccessPage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-100 flex items-center justify-center p-4">
      <Card className="w-full max-w-md border-green-200 shadow-lg">
        <CardContent className="pt-8 pb-8">
          <div className="text-center">
            <div className="flex justify-center mb-4">
              <CheckCircle2 className="w-16 h-16 text-green-600" />
            </div>

            <h1 className="text-2xl font-bold text-slate-900 mb-2">
              Enrollment Complete!
            </h1>

            <p className="text-slate-600 mb-6">
              Your enrollment form has been successfully submitted. We'll
              process your application and contact you soon with further
              details.
            </p>

            <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6 text-left">
              <p className="text-sm text-slate-700">
                <strong>What's next?</strong>
              </p>
              <ul className="text-sm text-slate-600 mt-2 space-y-1">
                <li>✓ Check your email for confirmation</li>
                <li>✓ You will receive a welcome message on WhatsApp</li>
                <li>✓ Access course materials in your student portal</li>
              </ul>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6 text-left">
              <p className="text-sm text-slate-700">
                <strong>Questions?</strong>
              </p>
              <p className="text-sm text-slate-600 mt-1">
                Contact us at: <br />
                📧 karthikeyananalysisstudycircle@gmail.com <br />
                📞 +91 63859 39895
              </p>
            </div>

            <div className="space-y-2">
              <Button onClick={() => navigate("/")} className="w-full">
                Go to Home
              </Button>
              <Button
                onClick={() => navigate("/login")}
                variant="outline"
                className="w-full"
              >
                Login to Portal
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
