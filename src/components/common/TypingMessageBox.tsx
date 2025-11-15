"use client";

import { useState, useEffect, useRef } from "react";
import styles from "./TypingMessageBox.module.css";

export interface TypingMessageBoxProps {
  /**
   * The text content to display with typing effect
   */
  text: string;
  /**
   * Typing speed in milliseconds per character
   * @default 20
   */
  speed?: number;
  /**
   * Unique identifier for the message (used to reset typing when message changes)
   */
  messageId?: string;
  /**
   * Callback when typing is complete
   */
  onComplete?: () => void;
  /**
   * Whether to show the typing cursor
   * @default true
   */
  showCursor?: boolean;
  /**
   * Custom className for the container
   */
  className?: string;
}

/**
 * TypingText component that displays text with a typing animation effect.
 * Handles streaming updates by detecting when text is being extended.
 */
const TypingText = ({
  text,
  speed = 20,
  onComplete,
  messageId,
  showCursor = true,
}: Omit<TypingMessageBoxProps, "className">) => {
  const [displayedText, setDisplayedText] = useState("");
  const [isTyping, setIsTyping] = useState(true);
  const displayedTextRef = useRef("");
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const currentIndexRef = useRef(0);
  const messageIdRef = useRef(messageId);
  const lastTextRef = useRef("");

  const clearTyping = () => {
    setTimeout(() => {
      setDisplayedText("");
      setIsTyping(false);
    });
    displayedTextRef.current = "";
    lastTextRef.current = "";
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  };

  useEffect(() => {
    if (!text) {
      clearTyping();
      return;
    }

    // If message ID changed, reset everything
    if (messageIdRef.current !== messageId) {
      currentIndexRef.current = 0;
      messageIdRef.current = messageId;
      clearTyping();
    }

    // Check if this is a streaming update (text is longer and starts with last text)
    const lastText = lastTextRef.current;
    const currentDisplayed = displayedTextRef.current;

    if (lastText && text.startsWith(lastText)) {
      // Streaming update - continue from where we are
      // Don't reset, just update the target
      lastTextRef.current = text;
      // Ensure interval is running
      if (!intervalRef.current) {
        setIsTyping(true);
        intervalRef.current = setInterval(() => {
          const targetText = lastTextRef.current;
          if (currentIndexRef.current < targetText.length) {
            const newText = targetText.slice(0, currentIndexRef.current + 1);
            setDisplayedText(newText);
            displayedTextRef.current = newText;
            currentIndexRef.current++;
          } else {
            setIsTyping(false);
            if (intervalRef.current) {
              clearInterval(intervalRef.current);
              intervalRef.current = null;
            }
            onComplete?.();
          }
        }, speed);
      }
      return; // Let the interval continue
    } else if (text === currentDisplayed) {
      // Already fully displayed
      setTimeout(() => setIsTyping(false));
      lastTextRef.current = text;
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    } else if (
      lastText &&
      text.length > lastText.length &&
      text.startsWith(currentDisplayed)
    ) {
      // Text is being extended - continue from current position
      lastTextRef.current = text;
      // Ensure interval is running
      if (!intervalRef.current) {
        setIsTyping(true);
        intervalRef.current = setInterval(() => {
          const targetText = lastTextRef.current;
          if (currentIndexRef.current < targetText.length) {
            const newText = targetText.slice(0, currentIndexRef.current + 1);
            setDisplayedText(newText);
            displayedTextRef.current = newText;
            currentIndexRef.current++;
          } else {
            setIsTyping(false);
            if (intervalRef.current) {
              clearInterval(intervalRef.current);
              intervalRef.current = null;
            }
            onComplete?.();
          }
        }, speed);
      }
      return; // Let the interval continue
    } else {
      // New text or different text - restart typing
      setDisplayedText("");
      displayedTextRef.current = "";
      currentIndexRef.current = 0;
      lastTextRef.current = text;
      
      setIsTyping(true);

      // Clear existing interval
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }

      // Start typing animation immediately
      intervalRef.current = setInterval(() => {
        const targetText = lastTextRef.current;
        if (currentIndexRef.current < targetText.length) {
          const newText = targetText.slice(0, currentIndexRef.current + 1);
          setDisplayedText(newText);
          displayedTextRef.current = newText;
          currentIndexRef.current++;
        } else {
          setIsTyping(false);
          if (intervalRef.current) {
            clearInterval(intervalRef.current);
            intervalRef.current = null;
          }
          onComplete?.();
        }
      }, speed);
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [text, speed, onComplete, messageId]);

  return (
    <span style={{ display: "inline-block", minHeight: "1em" }}>
      {displayedText}
      {isTyping && showCursor && (
        <span className={styles.typingCursor}>|</span>
      )}
    </span>
  );
};

/**
 * TypingMessageBox component that displays messages with a typing animation effect.
 * Supports streaming messages by detecting when text is being extended.
 */
export const TypingMessageBox = ({
  text,
  speed = 20,
  messageId,
  onComplete,
  showCursor = true,
  className = "",
}: TypingMessageBoxProps) => {
  return (
    <span className={className}>
      <TypingText
        text={text}
        speed={speed}
        messageId={messageId}
        onComplete={onComplete}
        showCursor={showCursor}
      />
    </span>
  );
};

