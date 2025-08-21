'use client';

import { useState } from 'react';
import { FileText, Brain, Download, Loader2, Copy, Zap, BarChart3, Search, Filter, Eye, ChevronRight, Sparkles } from 'lucide-react';
import { analyzeText } from './actions';
import Link from 'next/link';

interface AnalysisResult {
  data: Record<string, any>;
  fields: string[];
  inputType: string;
  confidence: number;
  summary: string;
  wordCount: number;
}

export default function InsightForgePage() {
  const [inputText, setInputText] = useState<string>('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'structured' | 'visual' | 'raw'>('structured');
  const [searchTerm, setSearchTerm] = useState<string>('');

  const handleAnalyze = async () => {
    if (!inputText.trim()) return;

    setIsAnalyzing(true);
    setError(null);

    try {
      const analysisResult = await analyzeText(inputText);
      
      if (analysisResult.success && analysisResult.data) {
        setResult(analysisResult.data);
      } else {
        setError(analysisResult.error || 'Analysis failed');
      }
    } catch (err) {
      setError('An unexpected error occurred during analysis');
      console.error('Analysis error:', err);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const downloadJSON = () => {
    if (!result) return;
    
    const dataStr = JSON.stringify(result.data, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
    
    const exportFileDefaultName = `insight_forge_analysis_${Date.now()}.json`;
    
    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
  };

  const copyToClipboard = () => {
    if (!result) return;
    navigator.clipboard.writeText(JSON.stringify(result.data, null, 2));
  };

  const clearInput = () => {
    setInputText('');
    setResult(null);
    setError(null);
    setSearchTerm('');
  };

  const filteredData = (data: Record<string, any>): Record<string, any> => {
    if (!searchTerm) return data;
    
    const filtered: Record<string, any> = {};
    Object.entries(data).forEach(([key, value]) => {
      if (key.toLowerCase().includes(searchTerm.toLowerCase()) || 
          JSON.stringify(value).toLowerCase().includes(searchTerm.toLowerCase())) {
        filtered[key] = value;
      }
    });
    return filtered;
  };

  const renderStructuredData = (data: Record<string, any>, depth = 0) => {
    const filtered = filteredData(data);
    
    return Object.entries(filtered).map(([key, value]) => (
      <div key={key} className={`mb-6 ${depth > 0 ? 'ml-6 pl-4 border-l-2 border-indigo-100' : ''}`}>
        <div className={`flex items-center gap-2 mb-3 ${depth === 0 ? 'text-lg' : 'text-base'}`}>
          <div className={`w-2 h-2 rounded-full ${depth === 0 ? 'bg-indigo-500' : 'bg-indigo-300'}`} />
          <h3 className={`font-semibold text-gray-800 ${depth === 0 ? 'text-lg' : 'text-base'}`}>
            {key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}
          </h3>
        </div>
        
        {Array.isArray(value) ? (
          <div className="space-y-3">
            <div className="text-sm text-gray-500 mb-2">Array with {value.length} items</div>
            {value.map((item, index) => (
              <div key={index} className="bg-gradient-to-r from-gray-50 to-gray-100 rounded-lg p-4 border border-gray-200">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xs bg-indigo-100 text-indigo-600 px-2 py-1 rounded-full">
                    Item {index + 1}
                  </span>
                </div>
                {typeof item === 'object' && item !== null ? (
                  renderStructuredData(item, depth + 1)
                ) : (
                  <span className="text-gray-700 break-words">{String(item)}</span>
                )}
              </div>
            ))}
          </div>
        ) : typeof value === 'object' && value !== null ? (
          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg p-4 border border-blue-200">
            {renderStructuredData(value, depth + 1)}
          </div>
        ) : (
          <div className="bg-white rounded-lg p-4 border border-gray-200 shadow-sm">
            <p className="text-gray-700 break-words whitespace-pre-wrap">
              {String(value)}
            </p>
          </div>
        )}
      </div>
    ));
  };

  const renderVisualData = (data: Record<string, any>) => {
    const filtered = filteredData(data);
    
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {Object.entries(filtered).map(([key, value]) => (
          <div key={key} className="bg-white rounded-xl p-6 shadow-lg border border-gray-100 hover:shadow-xl transition-shadow hover:border-indigo-100">
            <div className="flex items-center gap-2 mb-4">
              <BarChart3 className="h-5 w-5 text-indigo-600" />
              <h3 className="font-semibold text-gray-800">
                {key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}
              </h3>
            </div>
            
            {Array.isArray(value) ? (
              <div>
                <div className="text-2xl font-bold text-indigo-600 mb-2">{value.length}</div>
                <div className="text-sm text-gray-500 mb-3">Items in array</div>
                <div className="max-h-32 overflow-y-auto">
                  {value.slice(0, 3).map((item, index) => (
                    <div key={index} className="text-xs bg-gray-100 rounded p-2 mb-1">
                      {typeof item === 'object' ? JSON.stringify(item).slice(0, 50) + '...' : String(item).slice(0, 50) + (String(item).length > 50 ? '...' : '')}
                    </div>
                  ))}
                  {value.length > 3 && <div className="text-xs text-gray-400">+{value.length - 3} more...</div>}
                </div>
              </div>
            ) : typeof value === 'object' && value !== null ? (
              <div>
                <div className="text-2xl font-bold text-green-600 mb-2">{Object.keys(value).length}</div>
                <div className="text-sm text-gray-500 mb-3">Properties</div>
                <div className="max-h-32 overflow-y-auto">
                  {Object.keys(value).slice(0, 3).map((prop, index) => (
                    <div key={index} className="text-xs bg-gray-100 rounded p-2 mb-1">
                      {prop}
                    </div>
                  ))}
                  {Object.keys(value).length > 3 && <div className="text-xs text-gray-400">+{Object.keys(value).length - 3} more...</div>}
                </div>
              </div>
            ) : (
              <div>
                <div className="text-sm text-gray-500 mb-2">Value</div>
                <div className="bg-gray-50 rounded p-3 text-sm break-words">
                  {String(value).slice(0, 100) + (String(value).length > 100 ? '...' : '')}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50">
      {/* Header */}
      <div className="bg-white/90 backdrop-blur-sm shadow-sm border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center">
              <div className="relative">
                <Brain className="h-8 w-8 text-indigo-600 mr-3" />
                <Sparkles className="h-4 w-4 text-yellow-500 absolute -top-1 -right-1" />
              </div>
              <h1 className="text-2xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
                Insight Forge
              </h1>
              <span className="ml-3 px-3 py-1 bg-gradient-to-r from-indigo-100 to-purple-100 text-indigo-800 text-xs rounded-full font-medium">
                AI Data Organizer
              </span>
            </div>
            <div className="flex items-center gap-4">
              <Zap className="h-5 w-5 text-yellow-500" />
              <span className="text-sm text-gray-600 hover:text-indigo-600 transition-colors">
                <Link href="mailto:feedback@stridecampus.com" className="flex items-center gap-1">
                  Give Feedback <ChevronRight className="h-4 w-4" />
                </Link>
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Hero Section */}
        <div className="text-center mb-12">
          <h2 className="text-4xl font-bold text-gray-900 mb-4">
            Transform Unstructured Text into <span className="bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">Organized Insights</span>
          </h2>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto">
            Paste any text content and let our AI extract structured data, identify key information, and present it in an easily digestible format.
          </p>
        </div>

        {/* Input Section */}
        <div className="bg-white/90 backdrop-blur-sm rounded-2xl shadow-xl p-8 mb-8 border border-gray-200">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
                <FileText className="h-5 w-5 text-indigo-600" />
                Input Your Content
              </h2>
              <p className="text-sm text-gray-500 mt-1">
                Paste articles, notes, research data, or any unstructured text
              </p>
            </div>
            {inputText && (
              <button
                onClick={clearInput}
                className="text-sm text-gray-500 hover:text-red-600 transition-colors px-3 py-1 rounded-lg hover:bg-red-50"
              >
                Clear All
              </button>
            )}
          </div>
          
          <div className="space-y-4">
            <div className="relative">
              <textarea
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                placeholder="Paste your article, data, notes, or any text content here. The AI will organize and structure it for better understanding and analysis..."
                className="w-full h-64 p-4 text-gray-900 border border-gray-300 rounded-xl resize-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors bg-white/70 backdrop-blur-sm pr-10"
                disabled={isAnalyzing}
              />
              {!inputText && (
                <div className="absolute bottom-4 right-4 bg-indigo-100 text-indigo-700 text-xs px-2 py-1 rounded-lg">
                  Try pasting an article or research text
                </div>
              )}
            </div>
            
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="text-sm text-gray-500 flex items-center">
                <span className="bg-gray-100 rounded-lg px-2 py-1">
                  {inputText.length} characters
                </span>
                {inputText.length > 0 && (
                  <span className="ml-3 flex items-center text-indigo-600">
                    <Sparkles className="h-4 w-4 mr-1" />
                    Ready for analysis
                  </span>
                )}
              </div>
              
              <button
                onClick={handleAnalyze}
                disabled={isAnalyzing || !inputText.trim()}
                className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white py-3 px-8 rounded-xl hover:from-indigo-700 hover:to-purple-700 disabled:from-gray-400 disabled:to-gray-500 disabled:cursor-not-allowed flex items-center space-x-2 transition-all duration-200 shadow-lg hover:shadow-xl hover:scale-105 disabled:hover:scale-100 disabled:hover:shadow-lg"
              >
                {isAnalyzing ? (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin" />
                    <span>Analyzing with AI...</span>
                  </>
                ) : (
                  <>
                    <Brain className="h-5 w-5" />
                    <span>Organize & Analyze</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {error && (
            <div className="mt-4 bg-red-50 border border-red-200 rounded-xl p-4">
              <p className="text-red-700">{error}</p>
            </div>
          )}
        </div>

        {/* Results Section */}
        {result && (
          <div className="bg-white/90 backdrop-blur-sm rounded-2xl shadow-xl p-8 border border-gray-200">
            {/* Results Header */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between mb-6 gap-4">
              <div>
                <h2 className="text-2xl font-bold text-gray-900 mb-2 flex items-center gap-2">
                  <Sparkles className="h-6 w-6 text-yellow-500" />
                  Analysis Complete
                </h2>
                <p className="text-sm text-gray-600">
                  {result.inputType === 'text' ? 'Text Content' : 'Data File'} analyzed with AI • {(result.confidence * 100).toFixed(0)}% confidence
                </p>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={copyToClipboard}
                  className="flex items-center space-x-2 bg-indigo-100 text-indigo-700 px-4 py-2 rounded-lg hover:bg-indigo-200 transition-colors shadow-md"
                >
                  <Copy className="h-4 w-4" />
                  <span>Copy JSON</span>
                </button>
                <button
                  onClick={downloadJSON}
                  className="flex items-center space-x-2 bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition-colors shadow-md"
                >
                  <Download className="h-4 w-4" />
                  <span>Download</span>
                </button>
              </div>
            </div>

            {/* Summary */}
            {result.summary && (
              <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl p-6 mb-6 border border-blue-200">
                <h3 className="font-semibold text-gray-900 mb-2 flex items-center gap-2">
                  <Eye className="h-5 w-5 text-blue-600" />
                  AI Summary
                </h3>
                <p className="text-gray-700">{result.summary}</p>
              </div>
            )}

            {/* Statistics */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
              <div className="bg-gradient-to-r from-indigo-50 to-blue-50 rounded-xl p-4 text-center border border-indigo-200">
                <h3 className="font-medium text-indigo-900 text-sm">Fields Extracted</h3>
                <p className="text-2xl font-bold text-indigo-600">{result.fields.length}</p>
              </div>
              <div className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-xl p-4 text-center border border-green-200">
                <h3 className="font-medium text-green-900 text-sm">Data Points</h3>
                <p className="text-2xl font-bold text-green-600">
                  {Object.keys(result.data).length}
                </p>
              </div>
              <div className="bg-gradient-to-r from-purple-50 to-pink-50 rounded-xl p-4 text-center border border-purple-200">
                <h3 className="font-medium text-purple-900 text-sm">Confidence</h3>
                <p className="text-2xl font-bold text-purple-600">{(result.confidence * 100).toFixed(0)}%</p>
              </div>
              <div className="bg-gradient-to-r from-yellow-50 to-orange-50 rounded-xl p-4 text-center border border-yellow-200">
                <h3 className="font-medium text-yellow-900 text-sm">Word Count</h3>
                <p className="text-2xl font-bold text-yellow-600">{result.wordCount}</p>
              </div>
            </div>

            {/* View Controls */}
            <div className="flex flex-col sm:flex-row gap-4 mb-6">
              <div className="flex bg-gray-100 rounded-lg p-1">
                <button
                  onClick={() => setViewMode('structured')}
                  className={`px-4 py-2 rounded-md text-sm font-medium transition-colors flex items-center gap-2 ${
                    viewMode === 'structured' 
                      ? 'bg-white text-indigo-600 shadow-sm' 
                      : 'text-gray-600 hover:text-gray-800'
                  }`}
                >
                  <Filter className="h-4 w-4" />
                  Structured View
                </button>
                <button
                  onClick={() => setViewMode('visual')}
                  className={`px-4 py-2 rounded-md text-sm font-medium transition-colors flex items-center gap-2 ${
                    viewMode === 'visual' 
                      ? 'bg-white text-indigo-600 shadow-sm' 
                      : 'text-gray-600 hover:text-gray-800'
                  }`}
                >
                  <BarChart3 className="h-4 w-4" />
                  Visual Cards
                </button>
                <button
                  onClick={() => setViewMode('raw')}
                  className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                    viewMode === 'raw' 
                      ? 'bg-white text-indigo-600 shadow-sm' 
                      : 'text-gray-600 hover:text-gray-800'
                  }`}
                >
                  Raw JSON
                </button>
              </div>
              
              <div className="flex-1 max-w-md">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Search in results..."
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors"
                  />
                  {searchTerm && (
                    <button
                      onClick={() => setSearchTerm('')}
                      className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      ×
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Data Display */}
            <div className="border-t border-gray-200 pt-6">
              {viewMode === 'structured' && (
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-6 flex items-center gap-2">
                    <Filter className="h-5 w-5 text-indigo-600" />
                    Organized Data Structure
                  </h3>
                  <div className="max-h-96 overflow-y-auto pr-2">
                    {renderStructuredData(result.data)}
                  </div>
                </div>
              )}

              {viewMode === 'visual' && (
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-6 flex items-center gap-2">
                    <BarChart3 className="h-5 w-5 text-indigo-600" />
                    Visual Overview
                  </h3>
                  {renderVisualData(result.data)}
                </div>
              )}

              {viewMode === 'raw' && (
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-6">Raw JSON Output</h3>
                  <pre className="bg-gray-900 text-green-400 p-6 rounded-xl text-sm overflow-auto max-h-96 border border-gray-700">
                    {JSON.stringify(filteredData(result.data), null, 2)}
                  </pre>
                </div>
              )}
            </div>

            {/* Call to Action */}
            <div className="mt-8 pt-6 border-t border-gray-200 text-center">
              <p className="text-gray-600 mb-4">Found this useful? Analyze more content!</p>
              <button
                onClick={clearInput}
                className="bg-indigo-100 text-indigo-700 px-6 py-2 rounded-lg hover:bg-indigo-200 transition-colors"
              >
                Start New Analysis
              </button>
            </div>
          </div>
        )}

        {/* Empty State Illustration */}
        {!result && inputText.length === 0 && (
          <div className="text-center py-12 text-gray-400">
            <div className="mx-auto max-w-md">
              <Brain className="h-16 w-16 mx-auto mb-4 opacity-30" />
              <h3 className="text-lg font-medium mb-2">Your Analysis Awaits</h3>
              <p className="text-sm">Paste your content above to unlock structured insights</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}