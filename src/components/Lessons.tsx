import Markdown from "react-markdown";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import remarkGfm from "remark-gfm";

export default function Lessons({
  lessons,
}: {
  lessons: { title: string; markdown: string }[];
}) {
  return (
    <div className="w-4/5 mx-auto mt-8 space-y-6">
      {lessons.map((lesson) => (
        <Card key={lesson.title}>
          <CardHeader>
            <CardTitle>{lesson.title}</CardTitle>
          </CardHeader>
          <CardContent>
            <Markdown remarkPlugins={[remarkGfm]}>{lesson.markdown}</Markdown>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
