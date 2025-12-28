import React, { useState, useRef, useEffect } from 'react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { ScrollArea } from '../ui/scroll-area';
import { Send, Loader2 } from 'lucide-react';
import { cn } from '../../lib/utils';
import { formatRelativeTime, getInitials, getAvatarColor, ROLE_BADGE_STYLES } from './utils';

export const CommentsPanel = ({ comments, onAddComment, isSubmitting }) => {
  const [newMessage, setNewMessage] = useState('');
  const scrollRef = useRef(null);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!newMessage.trim() || isSubmitting) return;
    onAddComment(newMessage);
    setNewMessage('');
  };

  // Auto-scroll to bottom when new comments are added
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [comments]);

  return (
    <div className="flex flex-col h-full" data-testid="comments-panel">
      <h3 className="text-sm font-semibold text-slate-900 mb-4" style={{ fontFamily: 'Manrope, sans-serif' }}>
        Comments & Activity
      </h3>
      
      {/* Comments List */}
      <ScrollArea className="flex-1 pr-2" ref={scrollRef}>
        <div className="space-y-4">
          {comments.length === 0 ? (
            <p className="text-sm text-slate-500 text-center py-8">No comments yet</p>
          ) : (
            comments.map((comment, index) => (
              <div 
                key={comment.id || index} 
                className={cn(
                  "rounded-lg p-3",
                  comment.is_system ? "bg-amber-50 border border-amber-200" : "bg-slate-50"
                )}
                data-testid={`comment-${comment.id || index}`}
              >
                <div className="flex items-start gap-3">
                  {/* Avatar */}
                  {!comment.is_system && (
                    <div className={cn(
                      "w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium text-white flex-shrink-0",
                      getAvatarColor(comment.user_name)
                    )}>
                      {getInitials(comment.user_name)}
                    </div>
                  )}
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      {comment.is_system ? (
                        <span className="text-xs font-medium text-amber-700">System</span>
                      ) : (
                        <>
                          <span className="text-sm font-medium text-slate-900">
                            {comment.user_name}
                          </span>
                          <span className={cn(
                            "text-[10px] px-1.5 py-0.5 rounded-full font-medium",
                            ROLE_BADGE_STYLES[comment.role] || 'bg-slate-100 text-slate-600'
                          )}>
                            {comment.role}
                          </span>
                        </>
                      )}
                      <span className="text-xs text-slate-400">
                        {formatRelativeTime(comment.created_at)}
                      </span>
                    </div>
                    <p className={cn(
                      "text-sm mt-1",
                      comment.is_system ? "text-amber-800" : "text-slate-700"
                    )}>
                      {comment.message}
                    </p>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </ScrollArea>

      {/* Comment Input */}
      <form onSubmit={handleSubmit} className="mt-4 pt-4 border-t border-slate-200">
        <div className="flex gap-2">
          <Input
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder="Type a comment..."
            className="flex-1"
            disabled={isSubmitting}
            data-testid="comment-input"
          />
          <Button 
            type="submit" 
            size="icon"
            disabled={!newMessage.trim() || isSubmitting}
            className="bg-blue-600 hover:bg-blue-700"
            data-testid="send-comment-btn"
          >
            {isSubmitting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
          </Button>
        </div>
      </form>
    </div>
  );
};
