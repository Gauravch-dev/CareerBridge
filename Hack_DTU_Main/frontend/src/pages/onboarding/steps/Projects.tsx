import { Plus, Trash2, Folder, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useOnboarding } from '@/contexts/OnboardingContext';
import { useTranslation } from 'react-i18next';

export const Projects = () => {
    const { t } = useTranslation();
    const { data, updateStepData } = useOnboarding();
    const projects = data.projects || [];

    const addProject = () => {
        updateStepData('projects', [
            ...projects,
            {
                id: crypto.randomUUID(),
                title: '',
                description: '',
                technologies: '',
                link: ''
            }
        ]);
    };

    const removeProject = (id: string) => {
        updateStepData('projects', projects.filter(p => p.id !== id));
    };

    const updateEntry = (id: string, field: string, value: string) => {
        updateStepData('projects', projects.map(p =>
            p.id === id ? { ...p, [field]: value } : p
        ));
    };

    return (
        <div className="space-y-8 animate-fade-in">
            {projects.map((project, index) => (
                <div key={project.id} className="relative p-6 bg-card/50 rounded-xl border border-border space-y-4">
                    <div className="absolute -left-3 -top-3 w-8 h-8 bg-violet-500/10 rounded-full flex items-center justify-center text-violet-500 font-bold border border-violet-500/20">
                        {index + 1}
                    </div>

                    <div className="flex justify-between items-start">
                        <div className="flex items-center gap-2 mb-2">
                            <Folder className="w-5 h-5 text-muted-foreground" />
                            <h3 className="font-semibold">{t('projectsStep.details')}</h3>
                        </div>
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => removeProject(project.id)}
                            className="text-destructive hover:text-destructive hover:bg-destructive/10"
                        >
                            <Trash2 className="w-4 h-4" />
                        </Button>
                    </div>

                    <div className="grid md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label>{t('projectsStep.title')}</Label>
                            <Input
                                value={project.title}
                                onChange={(e) => updateEntry(project.id, 'title', e.target.value)}
                                placeholder={t('projectsStep.titlePlaceholder')}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>{t('projectsStep.technologies')}</Label>
                            <Input
                                value={project.technologies}
                                onChange={(e) => updateEntry(project.id, 'technologies', e.target.value)}
                                placeholder={t('projectsStep.technologiesPlaceholder')}
                            />
                        </div>
                        <div className="space-y-2 md:col-span-2">
                            <Label>{t('projectsStep.link')}</Label>
                            <div className="relative">
                                <Input
                                    value={project.link || ''}
                                    onChange={(e) => updateEntry(project.id, 'link', e.target.value)}
                                    placeholder={t('projectsStep.linkPlaceholder')}
                                    className="pr-10"
                                />
                                <ExternalLink className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                            </div>
                        </div>
                        <div className="space-y-2 md:col-span-2">
                            <Label>{t('projectsStep.description')}</Label>
                            <Textarea
                                value={project.description}
                                onChange={(e) => updateEntry(project.id, 'description', e.target.value)}
                                placeholder={t('projectsStep.descriptionPlaceholder')}
                                className="min-h-[100px]"
                            />
                        </div>
                    </div>
                </div>
            ))}

            <Button
                type="button"
                variant="outline"
                onClick={addProject}
                className="w-full h-12 border-dashed border-2 hover:border-violet-500 hover:text-violet-500 gap-2"
            >
                <Plus className="w-4 h-4" />
                {t('projectsStep.addProject')}
            </Button>
        </div>
    );
};
