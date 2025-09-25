using Microsoft.AspNetCore.Mvc;
using Stripe.Checkout;

namespace stripe_backend.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class CheckoutController : ControllerBase
    {
        [HttpPost("session")]
        public ActionResult CreateCheckoutSession()
        {
            // Ensure customer exists (demo logic: reuse static if exists, create otherwise)
            var customerService = new Stripe.CustomerService();
            Stripe.Customer customer;
            if (string.IsNullOrEmpty(MandateStore.CustomerId))
            {
                var customerOptions = new Stripe.CustomerCreateOptions
                {
                    Name = "Demo Customer",
                    Email = "demo@example.com"
                };
                customer = customerService.Create(customerOptions);
                MandateStore.CustomerId = customer.Id;
            }
            else
            {
                customer = customerService.Get(MandateStore.CustomerId);
            }

            var options = new SessionCreateOptions
            {
                Mode = "setup",
                PaymentMethodTypes = new List<string> { "bacs_debit" },
                SuccessUrl = "http://localhost:5173/success?session_id={CHECKOUT_SESSION_ID}",
                CancelUrl = "http://localhost:5173/cancel",
                Customer = customer.Id,
                SetupIntentData = new SessionSetupIntentDataOptions
                {
                    Metadata = new Dictionary<string, string>
                    {
                        { "purpose", "direct_debit_mandate" }
                    }
                }
            };

            var service = new SessionService();
            var session = service.Create(options);

            return Ok(new { id = session.Id, customerId = customer.Id });
        }

        [HttpGet("process-session")]
        public ActionResult ProcessCheckoutSession([FromQuery] string sessionId)
        {
            var sessionService = new SessionService();
            var session = sessionService.Get(sessionId);

            var setupIntentId = session.SetupIntentId;
            if (string.IsNullOrEmpty(setupIntentId))
            {
                return BadRequest(new { success = false, message = "No SetupIntent found for session" });
            }

            var setupIntentService = new Stripe.SetupIntentService();
            var setupIntent = setupIntentService.Get(setupIntentId);

            var mandateId = setupIntent.MandateId;
            var paymentMethodId = setupIntent.PaymentMethodId;

            // TODO: Save setupIntentId, mandateId, and paymentMethodId into your database
            // For demo purposes, saving into static MandateStore
            MandateStore.PaymentMethodId = paymentMethodId;
            MandateStore.MandateId = mandateId;
            MandateStore.CustomerId = setupIntent.CustomerId;

            return Ok(new
            {
                success = true,
                setupIntentId,
                mandateId,
                paymentMethodId,
                stored = new
                {
                    MandateStore.PaymentMethodId,
                    MandateStore.MandateId,
                    MandateStore.CustomerId
                }
            });
        }
        [HttpPost("debit")]
        public async Task<IActionResult> Debit([FromBody] DebitRequest request)
        {
            try
            {
                // Use stored mandate/payment method if available, else fallback to static demo IDs
                var paymentMethodId = !string.IsNullOrEmpty(MandateStore.PaymentMethodId)
                    ? MandateStore.PaymentMethodId
                    : "pm_demo_static";
                var mandateId = !string.IsNullOrEmpty(MandateStore.MandateId)
                    ? MandateStore.MandateId
                    : "mandate_demo_static";
                var customerId = !string.IsNullOrEmpty(MandateStore.CustomerId)
                    ? MandateStore.CustomerId
                    : "cus_demo_static";

                var options = new Stripe.PaymentIntentCreateOptions
                {
                    Amount = request.Amount,
                    Currency = request.Currency,
                    PaymentMethod = paymentMethodId,
                    Mandate = mandateId,
                    Customer = customerId,
                    Confirm = true,
                    AutomaticPaymentMethods = new Stripe.PaymentIntentAutomaticPaymentMethodsOptions
                    {
                        Enabled = true,
                        AllowRedirects = "never"
                    }
                };

                var service = new Stripe.PaymentIntentService();
                var paymentIntent = await service.CreateAsync(options);

                return Ok(new
                {
                    paymentIntent.Id,
                    UsedPaymentMethod = paymentMethodId,
                    UsedMandate = mandateId,
                    UsedCustomer = customerId
                });
            }
            catch (Exception ex)
            {
                return BadRequest(new { error = ex.Message });
            }
        }
    }

    public class DebitRequest
    {
        public long Amount { get; set; }
        public string Currency { get; set; } = "gbp";
    }

    // Simple static store for demo purposes
    public static class MandateStore
    {
        public static string? PaymentMethodId { get; set; }
        public static string? MandateId { get; set; }
        public static string? CustomerId { get; set; }
    }
}