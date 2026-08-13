import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { publicApi } from '../../api/client';
import { Video, Stethoscope, Download, ShieldCheck, AlertCircle, Loader2, Calendar } from 'lucide-react';

export const PublicWatchPage = ({ token: propToken }) => {
  const params = useParams();
  const token = propToken || params.token;

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (token) {
      fetchPublicVideo();
    }
  }, [token]);

  const fetchPublicVideo = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await publicApi.getPublicVideo(token);
      setData(res.data);
    } catch (err) {
      console.error(err);
      setError(err.message || 'Public video link is invalid or expired');
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = () => {
    if (!data?.video_url) return;
    const a = document.createElement('a');
    a.href = data.video_url;
    a.download = `PointBlank_Doctor_Video.mp4`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#FAFAFA] text-slate-800 flex flex-col items-center justify-center p-6">
        <Loader2 className="w-10 h-10 text-[#005570] animate-spin mb-4" />
        <p className="text-slate-500 text-sm font-medium">Loading PointBlank Public Healthcare Video...</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-[#FAFAFA] text-slate-800 flex flex-col items-center justify-center p-6 text-center">
        <div className="w-16 h-16 rounded-2xl bg-rose-50 text-rose-500 border border-rose-200 flex items-center justify-center mb-4">
          <AlertCircle className="w-8 h-8" />
        </div>
        <h2 className="text-2xl font-bold mb-2 text-slate-900">Public Video Link Expired or Invalid</h2>
        <p className="text-slate-500 text-sm max-w-md mx-auto mb-6">{error || 'This public watch link could not be loaded.'}</p>
        <a href="https://www.pointblank.co.in/" className="px-6 py-3 rounded-xl bg-[#005570] text-white text-xs font-bold hover:bg-[#004055] transition-all">
          Visit PointBlank Healthcare
        </a>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FAFAFA] text-slate-800 font-sans">
      {/* Top Header */}
      <header className="border-b border-slate-200 bg-white sticky top-0 z-40 shadow-xs">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-[#005570] text-white flex items-center justify-center font-extrabold text-sm shadow-sm">
              PB
            </div>
            <div>
              <h1 className="text-lg font-bold text-slate-900 tracking-tight">POINTBLANK</h1>
              <p className="text-[10px] font-bold text-[#007799]">Verified Healthcare Patient Share</p>
            </div>
          </div>

          <div className="flex items-center space-x-1.5 text-xs text-[#005570] bg-[#E6F3F7] border border-teal-200 px-3 py-1 rounded-full font-semibold">
            <ShieldCheck className="w-4 h-4 text-[#007799]" />
            <span>Secure Enterprise Share</span>
          </div>
        </div>
      </header>

      {/* Main Public Watch Player */}
      <main className="max-w-4xl mx-auto px-4 py-8 space-y-8">
        {/* Doctor Header Banner */}
        <div className="p-6 rounded-2xl bg-white border border-slate-200 flex items-center space-x-4 shadow-xs">
          <div className="w-14 h-14 rounded-2xl bg-[#005570] text-white font-bold text-xl flex items-center justify-center shadow-xs">
            {data.doctor_name.charAt(0)}
          </div>
          <div>
            <h2 className="text-xl font-extrabold text-slate-900">{data.doctor_name}</h2>
            <p className="text-xs text-slate-500 flex items-center space-x-1.5 mt-0.5 font-medium">
              <Stethoscope className="w-3.5 h-3.5 text-[#007799]" />
              <span>{data.specialization}</span>
            </p>
          </div>
        </div>

        {/* Video Player */}
        <div className="rounded-2xl bg-white border border-slate-200 overflow-hidden shadow-md">
          <div className="aspect-video bg-black relative flex items-center justify-center">
            <video
              src={data.video_url}
              controls
              autoPlay
              poster={data.thumbnail_url}
              className="w-full h-full object-contain"
            />
          </div>

          <div className="p-6 flex items-center justify-between bg-white border-t border-slate-100">
            <div className="flex items-center space-x-2 text-xs text-slate-500 font-medium">
              <Calendar className="w-4 h-4 text-[#007799]" />
              <span>Published on {new Date(data.created_at).toLocaleDateString()}</span>
            </div>

            <button
              onClick={handleDownload}
              className="inline-flex items-center space-x-2 px-6 py-2.5 rounded-xl bg-[#005570] hover:bg-[#004055] text-white font-bold text-xs shadow-md shadow-[#005570]/20 transition-all"
            >
              <Download className="w-4 h-4" />
              <span>Download MP4</span>
            </button>
          </div>
        </div>

        {/* Script Content */}
        <div className="p-6 rounded-2xl bg-white border border-slate-200 text-left space-y-2 shadow-xs">
          <h3 className="font-bold text-slate-900 text-sm">Doctor Message Transcript</h3>
          <p className="text-xs text-slate-700 bg-slate-50 p-4 rounded-xl border border-slate-200 leading-relaxed font-sans italic">
            "{data.script}"
          </p>
        </div>
      </main>
    </div>
  );
};
