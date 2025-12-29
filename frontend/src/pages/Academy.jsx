import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import { ScrollArea } from '../components/ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '../components/ui/alert-dialog';
import { 
  Loader2, 
  Plus, 
  Play, 
  FileText, 
  Image, 
  Edit2, 
  Trash2,
  BookOpen,
  GraduationCap,
  ChevronRight,
  Clock,
  UserPlus,
  Phone,
  Target,
  Palette,
  Ruler,
  Users,
  Folder,
  Video,
  File,
  ExternalLink,
  Upload,
  CheckCircle,
  AlertCircle
} from 'lucide-react';
import { Progress } from '../components/ui/progress';
import { toast } from 'sonner';
import { cn } from '../lib/utils';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

// Icon mapping for categories
const CATEGORY_ICONS = {
  'user-plus': UserPlus,
  'phone': Phone,
  'target': Target,
  'palette': Palette,
  'ruler': Ruler,
  'users': Users,
  'book-open': BookOpen,
  'folder': Folder
};

// Content type icons
const CONTENT_ICONS = {
  'video': Video,
  'pdf': File,
  'text': FileText,
  'mixed': BookOpen
};

const Academy = () => {
  const { user } = useAuth();
  
  // Data states
  const [categories, setCategories] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [lessons, setLessons] = useState([]);
  const [selectedLesson, setSelectedLesson] = useState(null);
  
  // Loading states
  const [loadingCategories, setLoadingCategories] = useState(true);
  const [loadingLessons, setLoadingLessons] = useState(false);
  const [loadingLesson, setLoadingLesson] = useState(false);
  
  // Modal states
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [showLessonModal, setShowLessonModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  
  // Form states
  const [editingCategory, setEditingCategory] = useState(null);
  const [editingLesson, setEditingLesson] = useState(null);
  const [categoryForm, setCategoryForm] = useState({ name: '', description: '', icon: 'folder' });
  const [lessonForm, setLessonForm] = useState({
    title: '', description: '', content_type: 'text',
    video_url: '', video_type: 'youtube', pdf_url: '',
    text_content: '', duration_minutes: null
  });
  
  // Action states
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  
  // File upload states
  const [uploadingVideo, setUploadingVideo] = useState(false);
  const [uploadingPdf, setUploadingPdf] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const videoInputRef = React.useRef(null);
  const pdfInputRef = React.useRef(null);

  useEffect(() => {
    fetchCategories();
  }, []);

  useEffect(() => {
    if (selectedCategory) {
      fetchLessons(selectedCategory.category_id);
    }
  }, [selectedCategory]);

  const fetchCategories = async () => {
    try {
      setLoadingCategories(true);
      const response = await axios.get(`${API}/academy/categories`, { withCredentials: true });
      setCategories(response.data || []);
      
      // Auto-select first category if available
      if (response.data?.length > 0 && !selectedCategory) {
        setSelectedCategory(response.data[0]);
      }
    } catch (err) {
      console.error('Failed to fetch categories:', err);
      toast.error('Failed to load categories');
    } finally {
      setLoadingCategories(false);
    }
  };

  const fetchLessons = async (categoryId) => {
    try {
      setLoadingLessons(true);
      setSelectedLesson(null);
      const response = await axios.get(`${API}/academy/lessons?category_id=${categoryId}`, { withCredentials: true });
      setLessons(response.data || []);
      
      // Auto-select first lesson if available
      if (response.data?.length > 0) {
        fetchLessonDetail(response.data[0].lesson_id);
      }
    } catch (err) {
      console.error('Failed to fetch lessons:', err);
      toast.error('Failed to load lessons');
    } finally {
      setLoadingLessons(false);
    }
  };

  const fetchLessonDetail = async (lessonId) => {
    try {
      setLoadingLesson(true);
      const response = await axios.get(`${API}/academy/lessons/${lessonId}`, { withCredentials: true });
      setSelectedLesson(response.data);
    } catch (err) {
      console.error('Failed to fetch lesson:', err);
    } finally {
      setLoadingLesson(false);
    }
  };

  const canEdit = ['Admin', 'Manager', 'SalesManager', 'DesignManager', 'ProductionOpsManager'].includes(user?.role);

  // Category CRUD
  const openCategoryModal = (category = null) => {
    if (category) {
      setEditingCategory(category);
      setCategoryForm({ name: category.name, description: category.description || '', icon: category.icon || 'folder' });
    } else {
      setEditingCategory(null);
      setCategoryForm({ name: '', description: '', icon: 'folder' });
    }
    setShowCategoryModal(true);
  };

  const saveCategory = async () => {
    if (!categoryForm.name.trim()) {
      toast.error('Category name is required');
      return;
    }
    
    try {
      setSaving(true);
      if (editingCategory) {
        await axios.put(`${API}/academy/categories/${editingCategory.category_id}`, categoryForm, { withCredentials: true });
        toast.success('Category updated');
      } else {
        await axios.post(`${API}/academy/categories`, categoryForm, { withCredentials: true });
        toast.success('Category created');
      }
      setShowCategoryModal(false);
      fetchCategories();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to save category');
    } finally {
      setSaving(false);
    }
  };

  // Lesson CRUD
  const openLessonModal = (lesson = null) => {
    if (lesson) {
      setEditingLesson(lesson);
      setLessonForm({
        title: lesson.title,
        description: lesson.description || '',
        content_type: lesson.content_type || 'text',
        video_url: lesson.video_url || '',
        video_type: lesson.video_type || 'youtube',
        pdf_url: lesson.pdf_url || '',
        text_content: lesson.text_content || '',
        duration_minutes: lesson.duration_minutes || null
      });
    } else {
      setEditingLesson(null);
      setLessonForm({
        title: '', description: '', content_type: 'text',
        video_url: '', video_type: 'youtube', pdf_url: '',
        text_content: '', duration_minutes: null
      });
    }
    setShowLessonModal(true);
  };

  const saveLesson = async () => {
    if (!lessonForm.title.trim()) {
      toast.error('Lesson title is required');
      return;
    }
    
    try {
      setSaving(true);
      const payload = { ...lessonForm, category_id: selectedCategory.category_id };
      
      if (editingLesson) {
        await axios.put(`${API}/academy/lessons/${editingLesson.lesson_id}`, payload, { withCredentials: true });
        toast.success('Lesson updated');
      } else {
        await axios.post(`${API}/academy/lessons`, payload, { withCredentials: true });
        toast.success('Lesson created');
      }
      setShowLessonModal(false);
      fetchLessons(selectedCategory.category_id);
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to save lesson');
    } finally {
      setSaving(false);
    }
  };

  // Delete
  const confirmDelete = (type, item) => {
    setDeleteTarget({ type, item });
    setShowDeleteConfirm(true);
  };

  const executeDelete = async () => {
    if (!deleteTarget) return;
    
    try {
      setDeleting(true);
      if (deleteTarget.type === 'category') {
        await axios.delete(`${API}/academy/categories/${deleteTarget.item.category_id}`, { withCredentials: true });
        toast.success('Category deleted');
        setSelectedCategory(null);
        setLessons([]);
        setSelectedLesson(null);
        fetchCategories();
      } else {
        await axios.delete(`${API}/academy/lessons/${deleteTarget.item.lesson_id}`, { withCredentials: true });
        toast.success('Lesson deleted');
        if (selectedLesson?.lesson_id === deleteTarget.item.lesson_id) {
          setSelectedLesson(null);
        }
        fetchLessons(selectedCategory.category_id);
      }
      setShowDeleteConfirm(false);
      setDeleteTarget(null);
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to delete');
    } finally {
      setDeleting(false);
    }
  };

  // Seed categories
  const seedCategories = async () => {
    try {
      await axios.post(`${API}/academy/seed`, {}, { withCredentials: true });
      toast.success('Default categories created');
      fetchCategories();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to seed categories');
    }
  };

  // File upload handler
  const handleFileUpload = async (file, fileType) => {
    if (!file) return null;
    
    const allowedVideoTypes = ['video/mp4', 'video/quicktime', 'video/x-msvideo', 'video/webm'];
    const allowedPdfTypes = ['application/pdf'];
    const maxSize = 500 * 1024 * 1024; // 500MB
    
    // Validate file type
    if (fileType === 'video' && !allowedVideoTypes.includes(file.type)) {
      toast.error('Invalid video format. Allowed: MP4, MOV, AVI, WEBM');
      return null;
    }
    if (fileType === 'pdf' && !allowedPdfTypes.includes(file.type)) {
      toast.error('Only PDF files are allowed');
      return null;
    }
    
    // Validate file size
    if (file.size > maxSize) {
      toast.error(`File too large. Maximum size is ${maxSize / (1024 * 1024)}MB`);
      return null;
    }
    
    const formData = new FormData();
    formData.append('file', file);
    
    try {
      if (fileType === 'video') {
        setUploadingVideo(true);
      } else {
        setUploadingPdf(true);
      }
      setUploadProgress(0);
      
      const response = await axios.post(`${API}/academy/upload`, formData, {
        withCredentials: true,
        headers: { 'Content-Type': 'multipart/form-data' },
        onUploadProgress: (progressEvent) => {
          const progress = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          setUploadProgress(progress);
        }
      });
      
      toast.success(`${fileType === 'video' ? 'Video' : 'PDF'} uploaded successfully`);
      return response.data.file_url;
    } catch (err) {
      console.error('Upload failed:', err);
      toast.error(err.response?.data?.detail || `Failed to upload ${fileType}`);
      return null;
    } finally {
      if (fileType === 'video') {
        setUploadingVideo(false);
      } else {
        setUploadingPdf(false);
      }
      setUploadProgress(0);
    }
  };

  const onVideoFileSelect = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    const fileUrl = await handleFileUpload(file, 'video');
    if (fileUrl) {
      setLessonForm(p => ({ ...p, video_url: fileUrl, video_type: 'uploaded' }));
    }
    // Reset input
    if (videoInputRef.current) {
      videoInputRef.current.value = '';
    }
  };

  const onPdfFileSelect = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    const fileUrl = await handleFileUpload(file, 'pdf');
    if (fileUrl) {
      setLessonForm(p => ({ ...p, pdf_url: fileUrl }));
    }
    // Reset input
    if (pdfInputRef.current) {
      pdfInputRef.current.value = '';
    }
  };

  // Render YouTube embed
  const getYouTubeEmbedUrl = (url) => {
    if (!url) return null;
    const match = url.match(/(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/);
    return match ? `https://www.youtube.com/embed/${match[1]}` : url;
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    return new Date(dateStr).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  };

  // Helper to get full URL for uploaded files
  const getFileUrl = (url) => {
    if (!url) return '';
    // If it's a relative URL (starts with /api), prepend the backend URL
    if (url.startsWith('/api')) {
      return `${process.env.REACT_APP_BACKEND_URL}${url}`;
    }
    return url;
  };

  return (
    <div className="h-[calc(100vh-7rem)] flex" data-testid="academy-page">
      {/* Left Panel - Categories */}
      <div className="w-64 border-r border-slate-200 bg-slate-50 flex flex-col">
        <div className="p-4 border-b border-slate-200">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-slate-900 flex items-center gap-2">
              <GraduationCap className="w-5 h-5 text-blue-600" />
              Academy
            </h2>
            {canEdit && (
              <Button size="sm" variant="ghost" onClick={() => openCategoryModal()}>
                <Plus className="w-4 h-4" />
              </Button>
            )}
          </div>
        </div>
        
        <ScrollArea className="flex-1">
          {loadingCategories ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-5 h-5 animate-spin text-blue-600" />
            </div>
          ) : categories.length === 0 ? (
            <div className="p-4 text-center">
              <BookOpen className="w-10 h-10 mx-auto text-slate-300 mb-2" />
              <p className="text-sm text-slate-500">No categories yet</p>
              {canEdit && user?.role === 'Admin' && (
                <Button size="sm" variant="outline" className="mt-2" onClick={seedCategories}>
                  Create Default Categories
                </Button>
              )}
            </div>
          ) : (
            <div className="p-2 space-y-1">
              {categories.map((category) => {
                const IconComponent = CATEGORY_ICONS[category.icon] || Folder;
                const isSelected = selectedCategory?.category_id === category.category_id;
                
                return (
                  <button
                    key={category.category_id}
                    onClick={() => setSelectedCategory(category)}
                    className={cn(
                      "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left text-sm transition-colors group",
                      isSelected ? "bg-blue-100 text-blue-700" : "hover:bg-slate-100 text-slate-700"
                    )}
                  >
                    <IconComponent className={cn("w-4 h-4 flex-shrink-0", isSelected ? "text-blue-600" : "text-slate-400")} />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{category.name}</p>
                      <p className="text-xs text-slate-500">{category.lesson_count || 0} lessons</p>
                    </div>
                    {isSelected && <ChevronRight className="w-4 h-4" />}
                  </button>
                );
              })}
            </div>
          )}
        </ScrollArea>
      </div>

      {/* Middle Panel - Lessons List */}
      <div className="w-72 border-r border-slate-200 flex flex-col">
        <div className="p-4 border-b border-slate-200">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-slate-900 truncate">{selectedCategory?.name || 'Select a category'}</h3>
              <p className="text-xs text-slate-500">{lessons.length} lessons</p>
            </div>
            {canEdit && selectedCategory && (
              <div className="flex gap-1">
                <Button size="sm" variant="ghost" onClick={() => openCategoryModal(selectedCategory)} title="Edit Category">
                  <Edit2 className="w-3.5 h-3.5" />
                </Button>
                <Button size="sm" variant="ghost" onClick={() => openLessonModal()} title="Add Lesson">
                  <Plus className="w-4 h-4" />
                </Button>
              </div>
            )}
          </div>
        </div>
        
        <ScrollArea className="flex-1">
          {!selectedCategory ? (
            <div className="p-4 text-center text-slate-500 text-sm">
              Select a category to view lessons
            </div>
          ) : loadingLessons ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-5 h-5 animate-spin text-blue-600" />
            </div>
          ) : lessons.length === 0 ? (
            <div className="p-4 text-center">
              <FileText className="w-8 h-8 mx-auto text-slate-300 mb-2" />
              <p className="text-sm text-slate-500">No lessons yet</p>
              {canEdit && (
                <Button size="sm" variant="outline" className="mt-2" onClick={() => openLessonModal()}>
                  <Plus className="w-4 h-4 mr-1" />Add Lesson
                </Button>
              )}
            </div>
          ) : (
            <div className="p-2 space-y-1">
              {lessons.map((lesson) => {
                const ContentIcon = CONTENT_ICONS[lesson.content_type] || FileText;
                const isSelected = selectedLesson?.lesson_id === lesson.lesson_id;
                
                return (
                  <button
                    key={lesson.lesson_id}
                    onClick={() => fetchLessonDetail(lesson.lesson_id)}
                    className={cn(
                      "w-full flex items-start gap-3 px-3 py-2.5 rounded-lg text-left text-sm transition-colors",
                      isSelected ? "bg-blue-50 border border-blue-200" : "hover:bg-slate-50 border border-transparent"
                    )}
                  >
                    <ContentIcon className={cn("w-4 h-4 mt-0.5 flex-shrink-0", isSelected ? "text-blue-600" : "text-slate-400")} />
                    <div className="flex-1 min-w-0">
                      <p className={cn("font-medium truncate", isSelected && "text-blue-700")}>{lesson.title}</p>
                      {lesson.duration_minutes && (
                        <p className="text-xs text-slate-400 flex items-center gap-1 mt-0.5">
                          <Clock className="w-3 h-3" />{lesson.duration_minutes} min
                        </p>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </ScrollArea>
      </div>

      {/* Right Panel - Lesson Content */}
      <div className="flex-1 flex flex-col bg-white">
        {!selectedLesson ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <BookOpen className="w-16 h-16 mx-auto text-slate-200 mb-4" />
              <h3 className="text-lg font-medium text-slate-600">Select a lesson</h3>
              <p className="text-slate-400 text-sm">Choose a lesson from the list to view its content</p>
            </div>
          </div>
        ) : loadingLesson ? (
          <div className="flex-1 flex items-center justify-center">
            <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
          </div>
        ) : (
          <>
            {/* Lesson Header */}
            <div className="p-6 border-b border-slate-200">
              <div className="flex items-start justify-between">
                <div>
                  <h1 className="text-xl font-bold text-slate-900">{selectedLesson.title}</h1>
                  {selectedLesson.description && (
                    <p className="text-slate-500 mt-1">{selectedLesson.description}</p>
                  )}
                  <div className="flex items-center gap-4 mt-2 text-xs text-slate-400">
                    {selectedLesson.duration_minutes && (
                      <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{selectedLesson.duration_minutes} min</span>
                    )}
                    <span>Updated {formatDate(selectedLesson.updated_at)}</span>
                  </div>
                </div>
                {canEdit && (
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={() => openLessonModal(selectedLesson)}>
                      <Edit2 className="w-4 h-4 mr-1" />Edit
                    </Button>
                    <Button size="sm" variant="outline" className="text-red-600 hover:bg-red-50" onClick={() => confirmDelete('lesson', selectedLesson)}>
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                )}
              </div>
            </div>
            
            {/* Lesson Content */}
            <ScrollArea className="flex-1 p-6">
              <div className="max-w-3xl space-y-6">
                {/* Video Content */}
                {selectedLesson.video_url && (
                  <div className="rounded-lg overflow-hidden bg-black aspect-video">
                    {selectedLesson.video_type === 'youtube' ? (
                      <iframe
                        src={getYouTubeEmbedUrl(selectedLesson.video_url)}
                        className="w-full h-full"
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        allowFullScreen
                        title={selectedLesson.title}
                      />
                    ) : (
                      <video 
                        controls 
                        className="w-full h-full" 
                        src={getFileUrl(selectedLesson.video_url)}
                        controlsList="nodownload"
                      >
                        Your browser does not support the video tag.
                      </video>
                    )}
                  </div>
                )}
                
                {/* PDF Content */}
                {selectedLesson.pdf_url && (
                  <Card>
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center">
                            <File className="w-5 h-5 text-red-600" />
                          </div>
                          <div>
                            <p className="font-medium text-slate-900">PDF Document</p>
                            <p className="text-sm text-slate-500">Click to view or download</p>
                          </div>
                        </div>
                        <Button variant="outline" onClick={() => window.open(getFileUrl(selectedLesson.pdf_url), '_blank')}>
                          <ExternalLink className="w-4 h-4 mr-2" />Open PDF
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                )}
                
                {/* Text Content */}
                {selectedLesson.text_content && (
                  <div className="prose prose-slate max-w-none">
                    <div 
                      className="whitespace-pre-wrap text-slate-700 leading-relaxed"
                      dangerouslySetInnerHTML={{ __html: selectedLesson.text_content.replace(/\n/g, '<br/>') }}
                    />
                  </div>
                )}
                
                {/* Images */}
                {selectedLesson.images?.length > 0 && (
                  <div className="space-y-4">
                    {selectedLesson.images.map((img, index) => (
                      <div key={index} className="rounded-lg overflow-hidden border border-slate-200">
                        <img src={img.url} alt={img.caption || `Image ${index + 1}`} className="w-full" />
                        {img.caption && (
                          <p className="p-3 text-sm text-slate-500 bg-slate-50">{img.caption}</p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
                
                {/* Empty state */}
                {!selectedLesson.video_url && !selectedLesson.pdf_url && !selectedLesson.text_content && selectedLesson.images?.length === 0 && (
                  <div className="text-center py-12">
                    <FileText className="w-12 h-12 mx-auto text-slate-300 mb-4" />
                    <p className="text-slate-500">No content added yet</p>
                    {canEdit && (
                      <Button variant="outline" className="mt-4" onClick={() => openLessonModal(selectedLesson)}>
                        Add Content
                      </Button>
                    )}
                  </div>
                )}
              </div>
            </ScrollArea>
          </>
        )}
      </div>

      {/* Category Modal */}
      <Dialog open={showCategoryModal} onOpenChange={setShowCategoryModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingCategory ? 'Edit Category' : 'New Category'}</DialogTitle>
            <DialogDescription>Create a training category to organize lessons</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Name *</Label>
              <Input
                value={categoryForm.name}
                onChange={(e) => setCategoryForm(p => ({ ...p, name: e.target.value }))}
                placeholder="e.g., Sales Training"
              />
            </div>
            <div>
              <Label>Description</Label>
              <Textarea
                value={categoryForm.description}
                onChange={(e) => setCategoryForm(p => ({ ...p, description: e.target.value }))}
                placeholder="Brief description of this category"
                rows={2}
              />
            </div>
            <div>
              <Label>Icon</Label>
              <Select value={categoryForm.icon} onValueChange={(v) => setCategoryForm(p => ({ ...p, icon: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="folder">Folder</SelectItem>
                  <SelectItem value="user-plus">User Plus</SelectItem>
                  <SelectItem value="phone">Phone</SelectItem>
                  <SelectItem value="target">Target</SelectItem>
                  <SelectItem value="palette">Palette</SelectItem>
                  <SelectItem value="ruler">Ruler</SelectItem>
                  <SelectItem value="users">Users</SelectItem>
                  <SelectItem value="book-open">Book</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCategoryModal(false)}>Cancel</Button>
            <Button onClick={saveCategory} disabled={saving}>
              {saving && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
              {editingCategory ? 'Save Changes' : 'Create Category'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Lesson Modal */}
      <Dialog open={showLessonModal} onOpenChange={setShowLessonModal}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingLesson ? 'Edit Lesson' : 'New Lesson'}</DialogTitle>
            <DialogDescription>Add training content to this category</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <Label>Title *</Label>
                <Input
                  value={lessonForm.title}
                  onChange={(e) => setLessonForm(p => ({ ...p, title: e.target.value }))}
                  placeholder="e.g., Introduction to Pre-Sales"
                />
              </div>
              <div className="col-span-2">
                <Label>Description</Label>
                <Textarea
                  value={lessonForm.description}
                  onChange={(e) => setLessonForm(p => ({ ...p, description: e.target.value }))}
                  placeholder="Brief description of this lesson"
                  rows={2}
                />
              </div>
              <div>
                <Label>Content Type</Label>
                <Select value={lessonForm.content_type} onValueChange={(v) => setLessonForm(p => ({ ...p, content_type: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="video">Video</SelectItem>
                    <SelectItem value="pdf">PDF</SelectItem>
                    <SelectItem value="text">Text</SelectItem>
                    <SelectItem value="mixed">Mixed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Duration (minutes)</Label>
                <Input
                  type="number"
                  value={lessonForm.duration_minutes || ''}
                  onChange={(e) => setLessonForm(p => ({ ...p, duration_minutes: e.target.value ? parseInt(e.target.value) : null }))}
                  placeholder="e.g., 15"
                />
              </div>
            </div>
            
            {/* Video Section */}
            {(lessonForm.content_type === 'video' || lessonForm.content_type === 'mixed') && (
              <div className="space-y-3 p-4 bg-slate-50 rounded-lg">
                <h4 className="font-medium text-slate-700 flex items-center gap-2"><Video className="w-4 h-4" />Video</h4>
                
                {/* Video upload area */}
                <div className="border-2 border-dashed border-slate-300 rounded-lg p-4 text-center hover:border-blue-400 transition-colors">
                  <input
                    ref={videoInputRef}
                    type="file"
                    accept=".mp4,.mov,.avi,.webm"
                    onChange={onVideoFileSelect}
                    className="hidden"
                    id="video-upload"
                  />
                  
                  {uploadingVideo ? (
                    <div className="space-y-2">
                      <Loader2 className="w-8 h-8 animate-spin mx-auto text-blue-600" />
                      <p className="text-sm text-slate-600">Uploading video...</p>
                      <Progress value={uploadProgress} className="w-full max-w-xs mx-auto" />
                      <p className="text-xs text-slate-500">{uploadProgress}%</p>
                    </div>
                  ) : lessonForm.video_url && lessonForm.video_type === 'uploaded' ? (
                    <div className="space-y-2">
                      <CheckCircle className="w-8 h-8 mx-auto text-green-600" />
                      <p className="text-sm text-green-700 font-medium">Video uploaded</p>
                      <p className="text-xs text-slate-500 truncate max-w-xs mx-auto">{lessonForm.video_url}</p>
                      <Button 
                        type="button" 
                        variant="outline" 
                        size="sm" 
                        onClick={() => videoInputRef.current?.click()}
                      >
                        <Upload className="w-4 h-4 mr-2" />Replace Video
                      </Button>
                    </div>
                  ) : (
                    <label htmlFor="video-upload" className="cursor-pointer">
                      <Upload className="w-8 h-8 mx-auto text-slate-400 mb-2" />
                      <p className="text-sm font-medium text-slate-700">Click to upload video</p>
                      <p className="text-xs text-slate-500 mt-1">MP4, MOV, AVI, WEBM (max 500MB)</p>
                    </label>
                  )}
                </div>
                
                {/* Divider */}
                <div className="flex items-center gap-2 text-xs text-slate-400">
                  <div className="flex-1 border-t border-slate-200" />
                  <span>OR use URL</span>
                  <div className="flex-1 border-t border-slate-200" />
                </div>
                
                {/* Manual URL input */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Video Source</Label>
                    <Select value={lessonForm.video_type} onValueChange={(v) => setLessonForm(p => ({ ...p, video_type: v, video_url: '' }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="uploaded">Uploaded File</SelectItem>
                        <SelectItem value="youtube">YouTube Link</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>{lessonForm.video_type === 'youtube' ? 'YouTube URL' : 'Video URL (if using external link)'}</Label>
                    <Input
                      value={lessonForm.video_url}
                      onChange={(e) => setLessonForm(p => ({ ...p, video_url: e.target.value }))}
                      placeholder={lessonForm.video_type === 'youtube' ? 'https://youtube.com/watch?v=...' : 'Leave empty if uploaded above'}
                      disabled={uploadingVideo}
                    />
                  </div>
                </div>
              </div>
            )}
            
            {/* PDF Section */}
            {(lessonForm.content_type === 'pdf' || lessonForm.content_type === 'mixed') && (
              <div className="space-y-3 p-4 bg-slate-50 rounded-lg">
                <h4 className="font-medium text-slate-700 flex items-center gap-2"><File className="w-4 h-4" />PDF Document</h4>
                
                {/* PDF upload area */}
                <div className="border-2 border-dashed border-slate-300 rounded-lg p-4 text-center hover:border-blue-400 transition-colors">
                  <input
                    ref={pdfInputRef}
                    type="file"
                    accept=".pdf"
                    onChange={onPdfFileSelect}
                    className="hidden"
                    id="pdf-upload"
                  />
                  
                  {uploadingPdf ? (
                    <div className="space-y-2">
                      <Loader2 className="w-8 h-8 animate-spin mx-auto text-blue-600" />
                      <p className="text-sm text-slate-600">Uploading PDF...</p>
                      <Progress value={uploadProgress} className="w-full max-w-xs mx-auto" />
                      <p className="text-xs text-slate-500">{uploadProgress}%</p>
                    </div>
                  ) : lessonForm.pdf_url ? (
                    <div className="space-y-2">
                      <CheckCircle className="w-8 h-8 mx-auto text-green-600" />
                      <p className="text-sm text-green-700 font-medium">PDF uploaded</p>
                      <p className="text-xs text-slate-500 truncate max-w-xs mx-auto">{lessonForm.pdf_url}</p>
                      <Button 
                        type="button" 
                        variant="outline" 
                        size="sm" 
                        onClick={() => pdfInputRef.current?.click()}
                      >
                        <Upload className="w-4 h-4 mr-2" />Replace PDF
                      </Button>
                    </div>
                  ) : (
                    <label htmlFor="pdf-upload" className="cursor-pointer">
                      <Upload className="w-8 h-8 mx-auto text-slate-400 mb-2" />
                      <p className="text-sm font-medium text-slate-700">Click to upload PDF</p>
                      <p className="text-xs text-slate-500 mt-1">PDF files only</p>
                    </label>
                  )}
                </div>
                
                {/* Divider */}
                <div className="flex items-center gap-2 text-xs text-slate-400">
                  <div className="flex-1 border-t border-slate-200" />
                  <span>OR use URL</span>
                  <div className="flex-1 border-t border-slate-200" />
                </div>
                
                {/* Manual URL input */}
                <div>
                  <Label>PDF URL (if using external link)</Label>
                  <Input
                    value={lessonForm.pdf_url}
                    onChange={(e) => setLessonForm(p => ({ ...p, pdf_url: e.target.value }))}
                    placeholder="Leave empty if uploaded above"
                    disabled={uploadingPdf}
                  />
                </div>
              </div>
            )}
            
            {/* Text Section */}
            {(lessonForm.content_type === 'text' || lessonForm.content_type === 'mixed') && (
              <div className="space-y-3 p-4 bg-slate-50 rounded-lg">
                <h4 className="font-medium text-slate-700 flex items-center gap-2"><FileText className="w-4 h-4" />Text Content</h4>
                <Textarea
                  value={lessonForm.text_content}
                  onChange={(e) => setLessonForm(p => ({ ...p, text_content: e.target.value }))}
                  placeholder="Enter lesson content here. You can use line breaks for formatting."
                  rows={8}
                />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowLessonModal(false)}>Cancel</Button>
            <Button onClick={saveLesson} disabled={saving}>
              {saving && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
              {editingLesson ? 'Save Changes' : 'Create Lesson'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {deleteTarget?.type === 'category' ? 'Category' : 'Lesson'}?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget?.type === 'category' 
                ? 'This will permanently delete this category and ALL lessons inside it. This action cannot be undone.'
                : 'This will permanently delete this lesson. This action cannot be undone.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={executeDelete} disabled={deleting} className="bg-red-600 hover:bg-red-700">
              {deleting && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default Academy;
