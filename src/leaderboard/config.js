// The Supabase project that stores the leaderboard. Both values are meant to be public: the
// publishable key only allows what the database rules permit (reading the weekly leaderboard)
// and calling the submit-score function, which checks every score itself.
// Leave them empty to turn the leaderboard off.
export const SUPABASE_URL = 'https://htzsqfcpsvxojiunhrtn.supabase.co';
export const SUPABASE_KEY = 'sb_publishable_DHQ86LtSOg07VAKuivHnWQ_MpwxZbqJ';
