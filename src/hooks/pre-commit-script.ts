export const PRE_COMMIT_SCRIPT = `npx archguard check
RESULT=$?
if [ $RESULT -ne 0 ]; then
  echo ""
  echo "Commit blocked by Architecture Guardian."
  echo "Fix the issues above or use --no-verify to bypass (not recommended)."
  exit $RESULT
fi`;
