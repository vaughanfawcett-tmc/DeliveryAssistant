export interface NexusStatus {
  id: number;
  name: string; // e.g. "Booked", "At Hub", "In Transit", "Out for Delivery", "Delivered"
}

export interface NexusRouteDetail {
  type: string;
  routeDate: string;
  regNo: string;
  round: string;
  status: string;
  palletCount: number;
}

export interface NexusConsignment {
  consignmentNumber: string;
  consignmentID: number;
  customerReference: string | null;
  status: NexusStatus;
  estimatedDelDate: string | null;   // MAY be null — handle explicitly downstream
  estimatedDelTime: string | null;
  startWindow: string | null;
  endWindow: string | null;
  delAddressLine1: string | null;
  delAddressTown: string | null;
  delAddressPostcode: string;        // postcode verification compares against this
  colDate: string | null;
  delDateTime: string | null;
  routeDetails: NexusRouteDetail[];
}
