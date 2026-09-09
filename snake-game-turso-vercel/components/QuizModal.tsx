'use client';

import { useState, useEffect } from 'react';

interface Question {
  id: number;
  question: string;
  options: string[];
}

interface QuizModalProps {
  isOpen: boolean;
  onClose: () => void;
  onPass: () => void;
}

export default function QuizModal({ isOpen, onClose, onPass }: QuizModalProps) {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [answers, setAnswers] = useState<number[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ passed: boolean; correct: number; total: number } | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen && questions.length === 0) {
      loadQuestions();
    }
  }, [isOpen]);

  const loadQuestions = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/quiz/questions');
      const data = await res.json();
      if (res.ok) {
        setQuestions(data.questions);
        setAnswers(new Array(data.questions.length).fill(-1));
      } else {
        setError(data.error || '获取题目失败');
      }
    } catch (err) {
      setError('网络错误，请重试');
    } finally {
      setLoading(false);
    }
  };

  const selectAnswer = (questionIndex: number, optionIndex: number) => {
    const newAnswers = [...answers];
    newAnswers[questionIndex] = optionIndex;
    setAnswers(newAnswers);
  };

  const submitAnswers = async () => {
    if (answers.some(a => a === -1)) {
      setError('请回答所有问题');
      return;
    }

    setSubmitting(true);
    setError('');
    try {
      const res = await fetch('/api/quiz/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          answers,
          questionIds: questions.map(q => q.id),
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setResult({ passed: data.passed, correct: data.correct, total: data.total });
        if (data.passed) {
          setTimeout(() => {
            onPass();
            handleClose();
          }, 2000);
        }
      } else {
        setError(data.error || '提交失败');
      }
    } catch (err) {
      setError('网络错误，请重试');
    } finally {
      setSubmitting(false);
    }
  };

  const handleClose = () => {
    setQuestions([]);
    setAnswers([]);
    setResult(null);
    setError('');
    onClose();
  };

  const retry = () => {
    setResult(null);
    setAnswers([]);
    loadQuestions();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-800 rounded-lg p-6 max-w-lg w-full max-h-[90vh] overflow-y-auto">
        <h2 className="text-xl font-bold text-green-400 mb-4 text-center">
          📝 答题解锁游戏
        </h2>
        <p className="text-gray-400 text-center mb-6 text-sm">
          今日免费次数已用完，答对3题即可解锁今日额外游戏机会
        </p>

        {loading && (
          <div className="text-center py-8">
            <div className="animate-spin w-8 h-8 border-4 border-green-500 border-t-transparent rounded-full mx-auto mb-4"></div>
            <p>加载题目中...</p>
          </div>
        )}

        {error && (
          <div className="bg-red-500/20 border border-red-500 text-red-300 p-3 rounded mb-4">
            {error}
          </div>
        )}

        {result && (
          <div className={`p-4 rounded mb-4 text-center ${
            result.passed ? 'bg-green-500/20 border border-green-500 text-green-300' : 'bg-red-500/20 border border-red-500 text-red-300'
          }`}>
            <p className="text-lg font-bold mb-2">
              {result.passed ? '🎉 恭喜通过！' : '😢 未通过'}
            </p>
            <p>答对 {result.correct}/{result.total} 题</p>
            {result.passed ? (
              <p className="text-sm mt-2">正在解锁游戏...</p>
            ) : (
              <button
                onClick={retry}
                className="mt-3 bg-white/10 hover:bg-white/20 px-4 py-1 rounded text-sm"
              >
                重新答题
              </button>
            )}
          </div>
        )}

        {!loading && !result && questions.length > 0 && (
          <div className="space-y-4">
            {questions.map((q, qIndex) => (
              <div key={q.id} className="bg-gray-700/50 p-4 rounded">
                <p className="font-medium mb-3">
                  {qIndex + 1}. {q.question}
                </p>
                <div className="space-y-2">
                  {q.options.map((option, oIndex) => (
                    <label
                      key={oIndex}
                      className={`flex items-center p-2 rounded cursor-pointer transition ${
                        answers[qIndex] === oIndex
                          ? 'bg-green-600/30 border border-green-500'
                          : 'bg-gray-700 hover:bg-gray-600'
                      }`}
                    >
                      <input
                        type="radio"
                        name={`question-${qIndex}`}
                        value={oIndex}
                        checked={answers[qIndex] === oIndex}
                        onChange={() => selectAnswer(qIndex, oIndex)}
                        className="mr-3"
                      />
                      {option}
                    </label>
                  ))}
                </div>
              </div>
            ))}

            <div className="flex gap-3 mt-6">
              <button
                onClick={handleClose}
                className="flex-1 bg-gray-600 hover:bg-gray-500 py-2 rounded font-medium transition"
              >
                取消
              </button>
              <button
                onClick={submitAnswers}
                disabled={submitting}
                className="flex-1 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 py-2 rounded font-medium transition"
              >
                {submitting ? '提交中...' : '提交答案'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
