import React from 'react';
import { Clock, XCircle, CheckCircle2, Loader2 } from 'lucide-react';
import { Badge } from './Badge';

/**
 * Maps each media type's own status vocabulary to a consistent Badge — one
 * place that knows "READY"/"ready"/"COMPLETED" all mean the same visual
 * state, instead of every card re-deriving its own variant/icon/label.
 */
export const MediaStatus = ({ kind, status }) => {
  if (kind === 'avatar') {
    if (status === 'unavailable') return <Badge variant="danger" icon={XCircle}>Unavailable</Badge>;
    if (status === 'READY') return <Badge variant="success">Ready</Badge>;
    if (status === 'FAILED') return <Badge variant="danger" icon={XCircle}>Failed</Badge>;
    return <Badge variant="warning" icon={Loader2} pulse>Preparing…</Badge>;
  }

  if (kind === 'voice') {
    if (status === 'ready') return <Badge variant="success">Ready</Badge>;
    if (status === 'failed') return <Badge variant="danger" icon={XCircle}>Failed</Badge>;
    return <Badge variant="warning" icon={Clock} pulse>Creating…</Badge>;
  }

  if (kind === 'video') {
    if (status === 'COMPLETED') return <Badge variant="success" icon={CheckCircle2}>Completed</Badge>;
    if (status === 'FAILED') return <Badge variant="danger" icon={XCircle}>Failed</Badge>;
    return <Badge variant="warning" icon={Loader2} pulse>Processing</Badge>;
  }

  return null;
};
