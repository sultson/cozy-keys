import React, { useState } from 'react';
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
  type CarouselApi,
} from "@/components/ui/carousel";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Sparkles, TreePine, LampDesk } from "lucide-react";

export interface Environment {
  id: string;
  name: string;
  icon: React.ReactNode;
  description: string;
}

const environments: Environment[] = [
  {
    id: 'quiet',
    name: 'Studio',
    icon: <LampDesk className="w-4 h-4" />,
    description: 'Quiet and minimal'
  },
  {
    id: 'nature',
    name: 'Nature',
    icon: <TreePine className="w-4 h-4" />,
    description: 'Organic and peaceful'
  },
  {
    id: 'cosmic',
    name: 'Cosmic',
    icon: <Sparkles className="w-4 h-4" />,
    description: 'Ethereal and dreamy'
  }
];

interface EnvironmentsProps {
  onEnvironmentChange?: (environment: Environment) => void;
}

export function Environments({ onEnvironmentChange }: EnvironmentsProps) {
  const [selectedEnvironment, setSelectedEnvironment] = useState<Environment>(environments[0]);
  const [api, setApi] = React.useState<CarouselApi>();



  React.useEffect(() => {
    if (!api) return;

    const handleSelect = () => {
      const selectedIndex = api.selectedScrollSnap();
      console.log('selectedIndex', selectedIndex);
      const environment = environments[selectedIndex];
      console.log('Environments: Carousel changed to index:', selectedIndex, 'environment:', environment);
      setSelectedEnvironment(environment);
      onEnvironmentChange?.(environment);
    };

    api.on('select', handleSelect);
    return () => {
      api.off('select', handleSelect);
    };
  }, [api, onEnvironmentChange]);

  return (
    <div className="flex items-center gap-2 w-22">
      <Carousel className="w-22" setApi={setApi}>
        <CarouselContent>
          {environments.map((environment) => (
            <CarouselItem key={environment.id}>
              <Button
                variant="ghost"
                size="sm"
                className={cn(
                  "h-8 px-3 text-xs font-medium transition-all",
                  selectedEnvironment.id === environment.id
                    ? ""
                    : "hover:bg-muted"
                )}
                title={environment.description}
              >
                <div className="flex items-center gap-1.5">
                  {environment?.icon}
                  <span>{environment.name}</span>
                </div>
              </Button>
            </CarouselItem>
          ))}
        </CarouselContent>
        <CarouselPrevious className="h-6 w-6" />
        <CarouselNext className="h-6 w-6 " />
      </Carousel>
    </div>
  );
} 