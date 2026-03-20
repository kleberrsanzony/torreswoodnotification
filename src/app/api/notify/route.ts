import { NextResponse } from 'next/server';
import { getAdminMessaging } from '@/lib/firebase-admin';
import { supabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const adminMessaging = getAdminMessaging();
    if (!adminMessaging) {
      return NextResponse.json(
        { error: 'Firebase Admin not configured' },
        { status: 500 }
      );
    }

    const body = await request.json();
    const { title, body: messageBody, icon = '/icon.svg', url = '/estoque' } = body;

    if (!title || !messageBody) {
      return NextResponse.json(
        { error: 'Missing title or body' },
        { status: 400 }
      );
    }

    // Fetch active tokens for the 'estoque' role
    const { data: tokens, error: supabaseError } = await supabase
      .from('device_tokens')
      .select('fcm_token')
      .eq('role', 'estoque')
      .eq('active', true);

    if (supabaseError) {
      console.error('Error fetching tokens:', supabaseError);
      return NextResponse.json(
        { error: 'Error fetching tokens from database' },
        { status: 500 }
      );
    }

    if (!tokens || tokens.length === 0) {
      console.log('API Notify: No active tokens found in DB.');
      return NextResponse.json(
        { message: 'No active devices registered for estoque' },
        { status: 200 }
      );
    }

    const fcmTokens = tokens.map(t => t.fcm_token);
    console.log(`API Notify: Sending to ${fcmTokens.length} tokens`);

    // Send notifications via Firebase Admin
    const sendResponse = await adminMessaging.sendEachForMulticast({
      tokens: fcmTokens,
      notification: {
        title,
        body: messageBody,
      },
      webpush: {
        notification: {
          icon,
        },
        fcmOptions: {
          link: url,
        },
      },
    });

    console.log(`API Notify: Success: ${sendResponse.successCount}, Failures: ${sendResponse.failureCount}`);

    // Optionally handle invalid tokens to set active=false
    if (sendResponse.failureCount > 0) {
      const failedTokens: string[] = [];
      sendResponse.responses.forEach((resp, idx) => {
        if (!resp.success) {
          const errorCode = resp.error?.code;
          if (
            errorCode === 'messaging/invalid-registration-token' ||
            errorCode === 'messaging/registration-token-not-registered'
          ) {
            failedTokens.push(fcmTokens[idx]);
          }
        }
      });

      if (failedTokens.length > 0) {
        await supabase
          .from('device_tokens')
          .update({ active: false })
          .in('fcm_token', failedTokens);
      }
    }

    return NextResponse.json({
      success: true,
      successCount: sendResponse.successCount,
      failureCount: sendResponse.failureCount,
    });

  } catch (error: any) {
    console.error('Error sending notification:', error);
    return NextResponse.json(
      { error: error?.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
