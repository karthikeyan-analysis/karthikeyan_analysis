import { Shield, Lock, Eye, Clock } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';

export default function SecurityNotice() {
  return (
    <Card className="border-indigo-200 bg-gradient-to-br from-indigo-50 to-white">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Shield className="w-5 h-5 text-indigo-600" />
          Security Implementation Guide
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="flex items-start gap-3 p-3 bg-white rounded-lg border border-indigo-100">
            <div className="w-10 h-10 bg-indigo-100 rounded-lg flex items-center justify-center flex-shrink-0">
              <Lock className="w-5 h-5 text-indigo-600" />
            </div>
            <div>
              <h4 className="font-medium text-slate-900 mb-1">HLS Encryption</h4>
              <p className="text-xs text-slate-600">
                Use AES-128 encryption to break videos into encrypted chunks. Implement using services like AWS MediaConvert or Cloudflare Stream.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3 p-3 bg-white rounded-lg border border-indigo-100">
            <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center flex-shrink-0">
              <Eye className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <h4 className="font-medium text-slate-900 mb-1">Dynamic Watermarks</h4>
              <p className="text-xs text-slate-600">
                Overlay student ID/email using canvas or CSS. Position should move dynamically to prevent easy cropping.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3 p-3 bg-white rounded-lg border border-indigo-100">
            <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center flex-shrink-0">
              <Clock className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <h4 className="font-medium text-slate-900 mb-1">Signed URLs</h4>
              <p className="text-xs text-slate-600">
                Generate time-limited URLs (2-4 hours) using CloudFront, Google Cloud Storage, or Firebase Storage signed URLs.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3 p-3 bg-white rounded-lg border border-indigo-100">
            <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center flex-shrink-0">
              <Shield className="w-5 h-5 text-orange-600" />
            </div>
            <div>
              <h4 className="font-medium text-slate-900 mb-1">Access Control</h4>
              <p className="text-xs text-slate-600">
                Implement database-level permissions. Use the SELECTIVE visibility type to restrict content to specific students.
              </p>
            </div>
          </div>
        </div>

        <div className="mt-4 p-4 bg-amber-50 border border-amber-200 rounded-lg">
          <p className="text-sm font-medium text-amber-900 mb-2">Production Recommendations</p>
          <ul className="text-xs text-amber-800 space-y-1">
            <li>• Store videos in private S3 buckets (not public)</li>
            <li>• Use a CDN with DRM support (Cloudflare, AWS CloudFront)</li>
            <li>• Implement rate limiting to prevent bulk downloads</li>
            <li>• Log all video access attempts for audit trails</li>
            <li>• Consider adding screen recording detection scripts</li>
            <li>• Implement token-based authentication for video endpoints</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}
