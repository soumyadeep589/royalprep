import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  BackHandler,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { ApiError, createApi, validateOrigin } from './src/api';

type Chapter = { name: string; questionCount: number };
type Question = { id: string; version: number; chapter: string; stem: string; options: string[] };
type Feedback = { correct: number; explanation: string; isCorrect: boolean };
type Session = { token: string; user: { email: string }; expiresAt: number };
type Screen = 'login' | 'chapters' | 'practice';

function App() {
  const [origin, setOrigin] = useState(__DEV__ ? 'http://10.0.2.2:4000' : '');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [session, setSession] = useState<Session>();
  const [screen, setScreen] = useState<Screen>('login');
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [chapter, setChapter] = useState('');
  const [questions, setQuestions] = useState<Question[]>([]);
  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState<number>();
  const [feedback, setFeedback] = useState<Feedback>();
  const [report, setReport] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  function clearSession() {
    setSession(undefined); setQuestions([]); setFeedback(undefined);
    setSelected(undefined); setCode(''); setScreen('login');
  }

  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      if (screen !== 'practice') return false;
      if (busy) return true;
      setQuestions([]); setFeedback(undefined); setScreen('chapters');
      setError(''); setMessage('');
      return true;
    });
    return () => subscription.remove();
  }, [screen, busy]);

  async function run(action: () => Promise<void>, authenticated = false) {
    setBusy(true); setError(''); setMessage('');
    try {
      validateOrigin(origin, __DEV__);
      await action();
    } catch (e) {
      if (authenticated && e instanceof ApiError && e.status === 401) clearSession();
      setError(e instanceof Error ? e.message : 'The request could not be completed.');
    } finally {
      setBusy(false);
    }
  }

  const api = createApi(origin, session?.token);
  function requestCode() {
    return run(async () => {
      const result = await api<{ message: string }>('/auth/otp/request', 'POST', { email });
      setMessage(result.message);
    });
  }
  function signIn() {
    return run(async () => {
      const result = await api<Session>('/auth/otp/verify', 'POST', { email, code });
      setSession(result); setCode(''); setScreen('chapters');
      try {
        setChapters(await createApi(origin, result.token)<Chapter[]>('/public/chapters'));
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Could not load chapters.');
      }
    });
  }
  function loadChapters() {
    return run(async () => setChapters(await api<Chapter[]>('/public/chapters')));
  }
  function openChapter(name: string) {
    return run(async () => {
      const result = await api<Question[]>('/practice/questions?chapter=' + encodeURIComponent(name));
      setChapter(name); setQuestions(result); setIndex(0); setSelected(undefined);
      setFeedback(undefined); setReport(''); setScreen('practice');
    }, true);
  }
  const question = questions[index];
  function submitAnswer() {
    if (!question || selected === undefined) return;
    return run(async () => {
      setFeedback(await api<Feedback>('/practice/questions/' + encodeURIComponent(question.id) + '/answer', 'POST', { version: question.version, option: selected }));
    }, true);
  }
  function sendReport() {
    if (!question) return;
    return run(async () => {
      await api('/practice/questions/' + encodeURIComponent(question.id) + '/reports', 'POST', { version: question.version, message: report });
      setReport(''); setMessage('Report sent. Thank you.');
    }, true);
  }
  function signOut() {
    return run(async () => {
      await api('/auth/logout', 'POST'); clearSession(); setMessage('Signed out.');
    }, true);
  }
  function nextQuestion() {
    setIndex(value => (value + 1) % questions.length); setSelected(undefined);
    setFeedback(undefined); setReport(''); setError(''); setMessage('');
  }

  return (
    <SafeAreaProvider>
      <SafeAreaView style={styles.safe}>
        <StatusBar barStyle="dark-content" />
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
          <Text style={styles.brand}>ROYALPREP</Text>
          {screen === 'login' && <>
            <Text style={styles.title}>Student sign in</Text>
            <Text style={styles.muted}>Request a verification code to sign in or create your account. Your session ends when the app closes.</Text>
            <Text style={styles.label}>Backend origin</Text>
            <TextInput accessibilityLabel="Backend origin" style={styles.input} value={origin} onChangeText={value => { setOrigin(value); setCode(''); setMessage(''); }} autoCapitalize="none" autoCorrect={false} keyboardType="url" editable={!busy} />
            <Text style={styles.label}>Email</Text>
            <TextInput accessibilityLabel="Email" style={styles.input} value={email} onChangeText={value => { setEmail(value); setCode(''); setMessage(''); }} autoCapitalize="none" autoCorrect={false} keyboardType="email-address" editable={!busy} />
            <Button title="Request code" disabled={busy || !email.trim()} onPress={requestCode} />
            <Text style={styles.label}>Six-digit code</Text>
            <TextInput accessibilityLabel="Six-digit code" style={styles.input} value={code} onChangeText={setCode} keyboardType="number-pad" maxLength={6} editable={!busy} />
            <Button title="Sign in" disabled={busy || !email.trim() || code.length !== 6} onPress={signIn} />
          </>}
          {screen === 'chapters' && <>
            <Text style={styles.title}>Chapter library</Text>
            <Text style={styles.muted}>Signed in as {session?.user.email}. Practice uses published questions; notes and progress are not available yet.</Text>
            <Button title="Refresh chapters" disabled={busy} onPress={loadChapters} />
            {chapters.length === 0 && !busy ? <Text style={styles.notice}>No chapters loaded. Refresh to check for published questions.</Text> : null}
            {chapters.map(item => <Pressable key={item.name} accessibilityRole="button" disabled={busy} style={styles.card} onPress={() => openChapter(item.name)}>
              <Text style={styles.cardTitle}>{item.name}</Text><Text style={styles.muted}>{item.questionCount} questions · Open practice</Text>
            </Pressable>)}
            <Button title="Sign out" disabled={busy} onPress={signOut} />
          </>}
          {screen === 'practice' && <>
            <Button title="Back to chapters" disabled={busy} onPress={() => { setScreen('chapters'); setQuestions([]); setError(''); setMessage(''); }} />
            <Text style={styles.title}>{chapter}</Text>
            {!question ? <Text style={styles.notice}>No published questions are available in this chapter.</Text> : <>
              <Text style={styles.muted}>Question {index + 1} of {questions.length}</Text>
              <Text style={styles.question}>{question.stem}</Text>
              {question.options.map((option, i) => <Pressable key={i} accessibilityRole="radio" accessibilityState={{ checked: selected === i, disabled: busy || !!feedback }} disabled={busy || !!feedback} style={[styles.option, selected === i && styles.chosen]} onPress={() => setSelected(i)}>
                <Text style={styles.optionText}>{String.fromCharCode(65 + i)}. {option}</Text>
              </Pressable>)}
              <Button title="Submit answer" disabled={busy || selected === undefined || !!feedback} onPress={submitAnswer} />
              {feedback && <View style={styles.card}><Text style={styles.cardTitle}>{feedback.isCorrect ? 'Correct' : 'Incorrect · Correct answer: ' + String.fromCharCode(65 + feedback.correct)}</Text><Text style={styles.optionText}>{feedback.explanation}</Text></View>}
              <Text style={styles.label}>Report an error (optional)</Text>
              <TextInput accessibilityLabel="Question report" style={[styles.input, styles.multiline]} value={report} onChangeText={setReport} maxLength={500} multiline editable={!busy} />
              <Button title="Send report" disabled={busy || !report.trim()} onPress={sendReport} />
              <Button title="Next question" disabled={busy} onPress={nextQuestion} />
            </>}
          </>}
          {busy && <ActivityIndicator accessibilityLabel="Loading" color="#6042a6" />}
          {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
          {message ? <Text accessibilityRole="alert" style={styles.notice}>{message}</Text> : null}
        </ScrollView>
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

function Button({ title, disabled, onPress }: { title: string; disabled: boolean; onPress: () => void }) {
  return <Pressable accessibilityRole="button" accessibilityState={{ disabled }} disabled={disabled} onPress={onPress} style={[styles.button, disabled && styles.disabled]}><Text style={styles.buttonText}>{title}</Text></Pressable>;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#f8f6fc' },
  content: { padding: 20, gap: 12, paddingBottom: 40 },
  brand: { color: '#6042a6', fontWeight: '800', letterSpacing: 2 },
  title: { color: '#211b32', fontSize: 28, fontWeight: '700' },
  muted: { color: '#5e576b', lineHeight: 21 },
  label: { color: '#211b32', fontWeight: '600' },
  input: { borderWidth: 1, borderColor: '#cbc4d7', borderRadius: 8, padding: 12, color: '#211b32', backgroundColor: '#fff' },
  multiline: { minHeight: 80, textAlignVertical: 'top' },
  button: { backgroundColor: '#6042a6', padding: 14, borderRadius: 8, alignItems: 'center' },
  disabled: { opacity: 0.45 },
  buttonText: { color: '#fff', fontWeight: '700' },
  card: { backgroundColor: '#fff', padding: 16, borderRadius: 10, borderWidth: 1, borderColor: '#e5deec', gap: 6 },
  cardTitle: { color: '#211b32', fontSize: 17, fontWeight: '700' },
  question: { color: '#211b32', fontSize: 19, lineHeight: 27, fontWeight: '600' },
  option: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#d9d2e3', borderRadius: 8, padding: 14 },
  chosen: { borderColor: '#6042a6', backgroundColor: '#eee8fa' },
  optionText: { color: '#211b32', lineHeight: 22 },
  error: { color: '#a42135', lineHeight: 21 },
  notice: { color: '#514174', lineHeight: 21 },
});

export default App;
