import { Routes, Route, Navigate } from 'react-router-dom';
import ProtectedRoute from './routes/ProtectedRoute';
import AdminLayout from './layouts/AdminLayout';
import Login from './pages/Login';
import Signup from './pages/Signup';
import Dashboard from './pages/Dashboard';
import Reviews from './pages/Reviews';
import ReviewForm from './pages/ReviewForm';
import ReviewEdit from './pages/ReviewEdit';
import ReviewRequests from './pages/ReviewRequests';
import PublicReviewForm from './pages/PublicReviewForm';
import ThankYou from './pages/ThankYou';
import Settings from './pages/Settings';
import HtmlCodeGenerator from './pages/HtmlCodeGenerator';

export default function App() {
  return (
    <Routes>
      {/* Public routes */}
      <Route path="/login" element={<Login />} />
      <Route path="/signup" element={<Signup />} />
      <Route path="/review/:token" element={<PublicReviewForm />} />
      <Route path="/thank-you" element={<ThankYou />} />

      {/* Protected admin routes */}
      <Route
        element={
          <ProtectedRoute>
            <AdminLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Dashboard />} />
        <Route path="reviews" element={<Reviews />} />
        <Route path="reviews/new" element={<ReviewForm />} />
        <Route path="reviews/:id/edit" element={<ReviewEdit />} />
        <Route path="review-requests" element={<ReviewRequests />} />
        <Route path="html-generator" element={<HtmlCodeGenerator />} />
        <Route path="settings" element={<Settings />} />
      </Route>

      {/* Fallback */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
