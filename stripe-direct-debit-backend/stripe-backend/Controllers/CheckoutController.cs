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
                    Email = "demo@receptionhq.com"
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
                // Validate request
                if (request.Amount <= 0)
                {
                    return BadRequest(new { error = "Amount must be greater than 0" });
                }

                // Get stored customer ID
                var customerId = !string.IsNullOrEmpty(MandateStore.CustomerId)
                    ? MandateStore.CustomerId
                    : throw new Exception("No customer found. Please create a mandate first using Setup Intent.");

                Console.WriteLine($"Processing debit for customer: {customerId}, Amount: {request.Amount} {request.Currency}");

                // Fetch the customer's BACS Direct Debit payment methods
                var paymentMethodService = new Stripe.PaymentMethodService();
                var paymentMethods = await paymentMethodService.ListAsync(new Stripe.PaymentMethodListOptions
                {
                    Customer = customerId,
                    Type = "bacs_debit"
                });

                if (paymentMethods.Data.Count == 0)
                {
                    return BadRequest(new { error = "No BACS Direct Debit payment method found for this customer. Please create a mandate first." });
                }

                // Use the most recent BACS Direct Debit payment method
                var paymentMethod = paymentMethods.Data
                    .OrderByDescending(pm => pm.Created)
                    .First();

                Console.WriteLine($"Using payment method: {paymentMethod.Id}");

                // Create PaymentIntent for BACS Direct Debit
                var options = new Stripe.PaymentIntentCreateOptions
                {
                    Amount = request.Amount,
                    Currency = request.Currency.ToLower(),
                    Customer = customerId,
                    PaymentMethod = paymentMethod.Id,
                    OffSession = true, // Merchant-initiated payment (no customer present)
                    Confirm = true, // Automatically confirm the payment
                    PaymentMethodTypes = new List<string> { "bacs_debit" },
                    Metadata = new Dictionary<string, string>
                    {
                        { "payment_type", "bacs_direct_debit" },
                        { "initiated_by", "merchant" }
                    }
                };

                var service = new Stripe.PaymentIntentService();
                var paymentIntent = await service.CreateAsync(options);

                Console.WriteLine($"Payment Intent created: {paymentIntent.Id}, Status: {paymentIntent.Status}");

                return Ok(new
                {
                    success = true,
                    id = paymentIntent.Id,
                    status = paymentIntent.Status,
                    amount = paymentIntent.Amount,
                    currency = paymentIntent.Currency,
                    paymentMethodId = paymentMethod.Id,
                    customerId = customerId,
                    message = $"BACS Direct Debit payment of {request.Currency.ToUpper()} {(request.Amount / 100.0):F2} initiated successfully."
                });
            }
            catch (Stripe.StripeException stripeEx)
            {
                Console.WriteLine($"Stripe error: {stripeEx.Message}");
                return BadRequest(new { error = $"Payment failed: {stripeEx.Message}" });
            }
            catch (Exception ex)
            {
                Console.WriteLine($"General error: {ex.Message}");
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